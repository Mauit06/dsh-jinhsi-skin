#!/usr/bin/env node
/**
 * validate-skin.mjs — 皮肤交付前的 fail-closed 自检。
 *
 * 覆盖四件事：
 *   1. skin.json 是否符合皮肤中心 v2 契约（skin-manifest-v2.schema.json）
 *   2. 两份 CSS 是否能被 lightningcss 解析，并逐条检查加载器的白名单
 *      （禁 @import、禁远程 / 协议相对 / 绝对路径 / ../ 逃逸）
 *   3. manifest 与 CSS 里引用的每个资源是否真实存在于皮肤目录内
 *   4. 主要前景 / 背景组合是否满足 WCAG AA(4.5:1)
 *
 * 无第三方硬依赖：lightningcss 若不可解析则跳过「真实解析」一步并明确标注，
 * 其余检查照常执行。
 *
 * 用法：node tools/validate-skin.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKIN = join(ROOT, 'skin')

/** 皮肤中心包的候选安装位置（用于解析官方 token 注册表与 lightningcss）。 */
const SKIN_CENTER_ROOTS = [
  process.env.DSH_HOME ? join(process.env.DSH_HOME, 'profiles/web/.dsh-module-fallback/node_modules') : null,
  'C:/Users/Lenovo/.dsh/profiles/web/.dsh-module-fallback/node_modules',
  'C:/Users/Lenovo/.dsh/profiles/web/node_modules',
].filter(Boolean)

const SKIN_CENTER_DIRS = SKIN_CENTER_ROOTS.map((r) => join(r, '@linxin666/dsh-client-ui-skin-center'))

/** 用于真实解析 CSS 的 lightningcss 解析根。 */
const LIGHTNING_ROOTS = [
  ...SKIN_CENTER_DIRS,
  ...SKIN_CENTER_ROOTS,
  'C:/Users/Lenovo/.dsh/profiles/web/node_modules/.pnpm/lightningcss@1.33.0/node_modules',
].filter((p) => existsSync(p))

/** ajv 的候选解析根（用于按官方 JSON Schema 真校验 manifest）。 */
const AJV_ROOTS = [
  ...SKIN_CENTER_ROOTS,
  join(process.env.APPDATA || '', 'npm/node_modules/@deepseek-ai/dsh/node_modules'),
  join(process.env.APPDATA || '', 'npm/node_modules'),
  process.env.APPDATA ? join(process.env.APPDATA, 'npm/node_modules/@deepseek-ai/dsh') : null,
].filter((p) => p && existsSync(p))

/** 官方 --dsw-* token 注册表；取不到时退化为「不做该检查」。 */
const OFFICIAL_TOKENS = (() => {
  for (const dir of SKIN_CENTER_DIRS) {
    const p = join(dir, 'contracts/official-tokens-v1.json')
    if (!existsSync(p)) continue
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8'))
      if (Array.isArray(parsed.tokens)) return new Set(parsed.tokens)
    } catch { /* 忽略，继续找 */ }
  }
  return null
})()

const problems = []
const warnings = []
const notes = []

const fail = (msg) => problems.push(msg)
const warn = (msg) => warnings.push(msg)
const note = (msg) => notes.push(msg)

// ───────────────────────────── 作用域化预演（复刻加载器逻辑）

/** 顶层逗号切分（括号 / 方括号 / 引号感知），对应加载器的 splitSelectors。 */
function splitTopLevel(text) {
  const parts = []
  let parens = 0
  let brackets = 0
  let quote = null
  let current = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote !== null) {
      current += ch
      if (ch === '\\') { current += text[i + 1] ?? ''; i += 1 }
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue }
    if (ch === '(') parens += 1
    else if (ch === ')') parens -= 1
    else if (ch === '[') brackets += 1
    else if (ch === ']') brackets -= 1
    if (ch === ',' && parens === 0 && brackets === 0) { parts.push(current); current = ''; continue }
    current += ch
  }
  parts.push(current)
  return parts
}

/** 收集所有规则的前导选择器文本；跳过 @ 开头的 at-rule，并整块跳过 @keyframes。 */
function collectPreludes(code) {
  const out = []
  let depth = 0
  let start = 0
  let skipUntilDepth = null
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i]
    if (ch === '{') {
      const prelude = code.slice(start, i).trim()
      if (skipUntilDepth === null && prelude.startsWith('@keyframes')) {
        skipUntilDepth = depth
      } else if (skipUntilDepth === null && prelude && !prelude.startsWith('@')) {
        out.push(prelude)
      }
      depth += 1
      start = i + 1
    } else if (ch === '}') {
      depth -= 1
      if (skipUntilDepth !== null && depth === skipUntilDepth) skipUntilDepth = null
      start = i + 1
    } else if (ch === ';' && depth === 0) {
      start = i + 1
    }
  }
  return out
}

/**
 * 复刻加载器的 scopeSelectorText（lib/index.js）。
 * 只关心分类与拼接结果——尤其是不匹配任何特判时会被拼成
 * `html[data-dsh-skin="…"] html[data-dsh-…] …`，要求 html 嵌套在 html 里。
 */
function simulateScope(selector, skinId) {
  const scope = `html[data-dsh-skin="${skinId}"]`
  const t = selector.trim()
  if (t === ':root' || t.startsWith(':root ') || t.startsWith(':root,')) return scope + t.slice(5)
  if (/^html\[data-ds-/.test(t)) return `${scope} body${t.slice(4)}`
  if (t === 'html' || t.startsWith('html ')) return scope + t.slice(4)
  if (t === 'body' || t.startsWith('body ') || t.startsWith('body[') || t.startsWith('body:')) return `${scope} ${t}`
  if (/^\[data-ds-[a-z0-9-]+/.test(t)) return `${scope} body${t}`
  return `${scope} ${t}`
}

// ───────────────────────────────────────────── 1. manifest 校验

// ───────────────────────────────────────────── 0. 自测（--self-test）

/** 证明「作用域化预演」真的会判死规则，而不是永远放行。 */
if (process.argv.includes('--self-test')) {
  const cases = [
    { sel: 'html[data-dsh-conversation-content="false"] [data-dsh-skin-layer="ambient"]::after', dead: true,
      why: '本次修掉的那条：以 html[data-dsh-…] 开头' },
    { sel: 'html[data-dsh-wallpaper-active] [data-dsh-skin-layer="background"]', dead: true,
      why: 'WE 适配如果写错锚点就会变成这条' },
    { sel: 'body[data-dsh-wallpaper-active] [data-dsh-skin-layer="background"]', dead: false,
      why: '正确的 WE 锚点' },
    { sel: 'body:not([data-dsh-conversation-content]) [data-dsh-skin-layer="ambient"]::after', dead: false,
      why: '修好后的空对话规则' },
    { sel: 'body[data-ds-dark-theme] [data-dsh-skin-layer="background"] > img', dead: false,
      why: '深色覆盖' },
    { sel: ':root', dead: false, why: '根 token 块' },
    { sel: 'html[data-ds-dark-theme]', dead: false, why: 'data-ds- 有特判，会被改写成 body' },
    { sel: '[data-dsh-surface="composer"]', dead: false, why: '裸属性开头' },
    { sel: 'html[data-dsh-wallpaper-active] body', dead: true, why: '以 html[data-dsh- 开头的另一种写法' },
  ]
  let failed = 0
  for (const c of cases) {
    const scoped = simulateScope(c.sel, 'jinhsi-spectro')
    const isDead = /^html\[data-dsh-skin="[^"]+"\]\s*html\[/.test(scoped)
    const ok = isDead === c.dead
    if (!ok) failed += 1
    console.log(`${ok ? '  ✓' : '  ✗'} ${c.dead ? '应判死' : '应通过'}  ${c.sel}`)
    console.log(`      → ${scoped}`)
  }
  console.log('')
  console.log(failed === 0 ? '自测通过：判死逻辑按预期工作。' : `自测失败：${failed} 条不符合预期。`)
  process.exit(failed === 0 ? 0 : 1)
}

const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/
const REL_PATH_PATTERN = /^(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*:\/\/)[A-Za-z0-9._\-/]+$/

const ROOT_KEYS = new Set([
  '$schema', 'skinManifestVersion', 'id', 'name', 'nameEn', 'version', 'author',
  'tagline', 'description', 'tags', 'accent', 'order', 'license', 'licenseUrl',
  'noticeUrl', 'sourceUrl', 'attribution', 'preview', 'requires', 'contributes',
  'facets', 'package', 'wiring', 'bodyAttr',
])
const DEPRECATED_KEYS = new Set(['package', 'wiring', 'bodyAttr'])
const REQUIRED_KEYS = ['skinManifestVersion', 'id', 'name', 'nameEn', 'version', 'author', 'contributes']

let manifest = null
try {
  manifest = JSON.parse(readFileSync(join(SKIN, 'skin.json'), 'utf8'))
} catch (err) {
  fail(`skin.json 读取或解析失败：${err.message}`)
}

if (manifest) {
  for (const key of REQUIRED_KEYS) {
    if (manifest[key] === undefined) fail(`skin.json 缺少必填字段 "${key}"`)
  }
  for (const key of Object.keys(manifest)) {
    if (!ROOT_KEYS.has(key)) fail(`skin.json 含未知字段 "${key}"（契约 additionalProperties:false，fail-closed）`)
    else if (DEPRECATED_KEYS.has(key)) warn(`skin.json 含 v1 弃用字段 "${key}"，会被忽略并产生迁移警告`)
  }
  if (manifest.skinManifestVersion !== 2) fail(`skin.json skinManifestVersion 必须是 2，实际 ${manifest.skinManifestVersion}`)
  if (!ID_PATTERN.test(manifest.id ?? '')) fail(`skin.json id "${manifest.id}" 不符合 ^[a-z][a-z0-9-]{0,31}$`)
  if (!VERSION_PATTERN.test(manifest.version ?? '')) fail(`skin.json version "${manifest.version}" 不是合法 semver`)
  if (manifest.accent !== undefined && !ACCENT_PATTERN.test(manifest.accent)) fail(`skin.json accent "${manifest.accent}" 不是 #rrggbb`)
  if (manifest.order !== undefined && !Number.isInteger(manifest.order)) fail('skin.json order 必须是整数')
  if (!Array.isArray(manifest.tags)) warn('skin.json 未声明 tags')
  else if (new Set(manifest.tags).size !== manifest.tags.length) fail('skin.json tags 含重复项（契约 uniqueItems:true）')

  if (manifest.preview) {
    for (const scheme of ['light', 'dark']) {
      if (!manifest.preview[scheme]) fail(`skin.json preview 缺少 "${scheme}"（契约要求两者同时存在）`)
    }
  }

  const contributes = manifest.contributes ?? {}
  if (!contributes.stylesheet) fail('skin.json contributes.stylesheet 必填')
  for (const key of Object.keys(contributes)) {
    if (!['stylesheet', 'patches', 'backgroundMedia'].includes(key)) {
      fail(`skin.json contributes 含未知字段 "${key}"`)
    }
  }

  // 收集 manifest 里引用的所有相对路径
  const referenced = []
  const addRef = (p, where) => {
    if (typeof p !== 'string') { fail(`${where} 不是字符串`); return }
    if (!REL_PATH_PATTERN.test(p)) { fail(`${where} "${p}" 不是合法的皮肤内相对路径`); return }
    referenced.push({ path: p, where })
  }

  if (contributes.stylesheet) addRef(contributes.stylesheet, 'contributes.stylesheet')
  if (contributes.patches) addRef(contributes.patches, 'contributes.patches')
  if (manifest.preview) {
    for (const scheme of ['light', 'dark']) {
      if (manifest.preview[scheme]) addRef(manifest.preview[scheme], `preview.${scheme}`)
    }
  }

  const bg = contributes.backgroundMedia
  if (bg) {
    for (const key of Object.keys(bg)) {
      if (!['light', 'dark'].includes(key)) { fail(`backgroundMedia 含未知键 "${key}"`); continue }
      const layer = bg[key]
      for (const lk of Object.keys(layer)) {
        if (!['type', 'src', 'scrim'].includes(lk)) fail(`backgroundMedia.${key} 含未知字段 "${lk}"`)
      }
      if (!['image', 'video'].includes(layer.type)) fail(`backgroundMedia.${key}.type 必须是 image 或 video`)
      addRef(layer.src, `backgroundMedia.${key}.src`)
    }
  }

  // facets.client 是本皮肤刻意不声明的：本地皮肤 hooks 会被 provenance 拒绝
  if (manifest.facets?.client) {
    warn('skin.json 声明了 facets.client —— 本地（非市场）皮肤目录的 hooks 会被 provenance 校验拒绝，'
      + '该 facet 不会生效，并会在皮肤中心留下「hooks 被拒绝」诊断。建议移除。')
  }

  // ───────────────────────────── 1b. 按官方 JSON Schema 真校验

  const schemaPath = SKIN_CENTER_DIRS
    .map((d) => join(d, 'contracts/skin-manifest-v2.schema.json'))
    .find((p) => existsSync(p))

  let ajv = null
  for (const root of AJV_ROOTS) {
    try {
      const req = createRequire(join(root, 'noop.js'))
      ajv = req('ajv/dist/2020').default ?? req('ajv/dist/2020')
      break
    } catch { /* 试下一个 root */ }
  }

  if (schemaPath === undefined) {
    note('未找到官方 JSON Schema（contracts/skin-manifest-v2.schema.json）—— 跳过 schema 真校验。')
  } else if (ajv === null) {
    note('未解析到 ajv —— 跳过 schema 真校验（上面已执行等价的手写规则检查）。')
  } else {
    try {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
      const validate = new ajv({ allErrors: true, strict: false }).compile(schema)
      if (validate(manifest)) {
        note(`官方 JSON Schema 校验通过（${relative(SKIN_CENTER_DIRS.find((d) => schemaPath.startsWith(d)) ?? '', schemaPath)}）`)
      } else {
        for (const e of validate.errors ?? []) {
          fail(`schema: ${e.instancePath || '/'} ${e.message}`)
        }
      }
    } catch (err) {
      warn(`schema 真校验无法执行：${err.message}`)
    }
  }

  // ───────────────────────────── 2. 资源存在性

  for (const { path, where } of referenced) {
    const abs = resolve(SKIN, path)
    const rel = relative(SKIN, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) { fail(`${where} "${path}" 逃逸出皮肤目录`); continue }
    if (!existsSync(abs)) fail(`${where} 指向的文件不存在：skin/${path}`)
  }

  // ───────────────────────────── 3. CSS 校验

  const cssFiles = [contributes.stylesheet, contributes.patches].filter(Boolean)
  const cssTexts = new Map()

  for (const name of cssFiles) {
    const abs = join(SKIN, name)
    if (!existsSync(abs)) { fail(`CSS 文件不存在：skin/${name}`); continue }
    const text = readFileSync(abs, 'utf8')
    cssTexts.set(name, text)

    // 文本级检查在「去注释」后的代码上进行：契约的 @import / URL 规则走 lightningcss
    // 的 AST 访问器，注释里的字样不会触发，这里必须保持一致，否则误报。
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '')

    // 3a. 白名单：文本级检查（与加载器 checkUrl 同规则）
    if (/@import\b/i.test(code)) fail(`skin/${name}: 使用了 @import（皮肤必须是单文件样式表）`)

    for (const m of code.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
      const target = m[2].trim()
      if (/^https?:\/\//i.test(target)) fail(`skin/${name}: 远程 URL "${target}" 不允许，资源必须随皮肤目录分发`)
      else if (target.startsWith('//')) fail(`skin/${name}: 协议相对 URL "${target}" 不允许`)
      else if (target.startsWith('/')) fail(`skin/${name}: 绝对路径 "${target}" 逃逸出皮肤目录`)
      else if (/^\.\.\//.test(target)) fail(`skin/${name}: 路径 "${target}" 逃逸出皮肤目录`)
      else if (/^data:/i.test(target)) warn(`skin/${name}: 内联 data: URL（加载器仅告警，但建议改用 assets/ 下的文件）`)
      else {
        const clean = target.split(/[?#]/)[0]
        const abs = resolve(SKIN, clean)
        const rel = relative(SKIN, abs)
        if (rel.startsWith('..') || isAbsolute(rel)) fail(`skin/${name}: url("${target}") 逃逸出皮肤目录`)
        else if (!existsSync(abs)) fail(`skin/${name}: url("${target}") 指向的文件不存在`)
      }
    }

    // 3b. CSS-Modules 哈希类名依赖（加载器告警项）
    const hashMatches = [...code.matchAll(/\[class[*^$|~]?=/g)]
    if (hashMatches.length) {
      warn(`skin/${name}: 有 ${hashMatches.length} 处 [class*=…] 匹配，依赖官方 CSS-Modules 哈希类名，官方重建即可能失效`)
    }

    // 3c. 通用 @keyframes 名（加载器告警项）
    const GENERIC = new Set(['spin', 'pulse', 'fade', 'fadein', 'fade-in', 'fadeout', 'fade-out',
      'slide', 'slidein', 'slide-in', 'bounce', 'glow', 'blink', 'shake', 'float'])
    for (const m of code.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)) {
      if (GENERIC.has(m[1].toLowerCase())) warn(`skin/${name}: @keyframes 名 "${m[1]}" 过于通用，建议加前缀避免跨皮肤撞名`)
    }

    // 3d. L1 token 名必须来自官方注册表（未注册的名字只会被忽略）
    if (OFFICIAL_TOKENS === null) {
      note('未找到官方 token 注册表（contracts/official-tokens-v1.json）—— 跳过 token 名核对。')
    } else {
      const unknown = new Set()
      for (const m of code.matchAll(/(--dsw-[\w-]+)\s*:/g)) {
        if (!OFFICIAL_TOKENS.has(m[1]) && !m[1].startsWith('--dsw-skin-')) unknown.add(m[1])
      }
      for (const name of unknown) {
        note(`skin/${name}: 定义了不在快照内的 token "${name}"。快照记录的是官方壳层「定义过」的 token；`
          + '壳层消费但从未定义的 token 不在其中，因此这条通常无害，但值得人工确认拼写。')
      }
      if (unknown.size === 0) {
        note(`skin/${name}: 全部 --dsw-* token 均在官方注册表（${OFFICIAL_TOKENS.size} 项）内`)
      }
    }
  }

  // 3e. 作用域化预演：把加载器的 scopeSelectorText 复刻一遍，抓「永不匹配」的选择器。
  //     这是离线最容易漏、上线后又不报错的一类 bug：规则语法完全合法、lightningcss
  //     也照过，但拼出来的选择器要求 html 嵌套在 html 里，于是静默失效。
  if (manifest) {
    const deadSelectors = []
    for (const [name, text] of cssTexts) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const prelude of collectPreludes(code)) {
        for (const sel of splitTopLevel(prelude)) {
          if (sel.trim() === '') continue
          const scoped = simulateScope(sel, manifest.id)
          if (/^html\[data-dsh-skin="[^"]+"\]\s*html\[/.test(scoped)) {
            deadSelectors.push(`${name}: "${sel.trim()}" → ${scoped}（要求 html 嵌套在 html 内，永不匹配）`)
          }
        }
      }
    }
    if (deadSelectors.length) {
      for (const d of deadSelectors) fail(`死规则 —— ${d}`)
    } else {
      note('作用域化预演：没有永不匹配的选择器')
    }
  }

  // 3f. 真实解析：用皮肤中心依赖的 lightningcss 跑一遍，证明加载器不会因语法错而 fail-closed
  let lightningcss = null
  for (const root of LIGHTNING_ROOTS) {
    try {
      lightningcss = createRequire(join(root, 'noop.js'))('lightningcss')
      break
    } catch { /* 继续找下一个 root */ }
  }

  if (lightningcss === null) {
    note('未能解析 lightningcss —— 跳过真实解析步骤（文本级白名单检查已执行）。'
      + '如需完整校验，请在有 @linxin666/dsh-client-ui-skin-center 的 DSH Web profile 环境下运行。')
  } else {
    let parsed = 0
    for (const [name, text] of cssTexts) {
      for (const mode of ['stylesheet', 'patches']) {
        if (mode === 'patches' && name !== contributes.patches) continue
        if (mode === 'stylesheet' && name !== contributes.stylesheet) continue
        try {
          lightningcss.transform({
            filename: name,
            code: Buffer.from(text),
            errorRecovery: false,
          })
          parsed += 1
        } catch (err) {
          fail(`skin/${name}: lightningcss 解析失败（加载器会 fail-closed 拒绝整个皮肤）：${err.message}`)
        }
      }
    }
    if (parsed === cssTexts.size) note(`lightningcss 已成功解析 ${parsed} 份样式表（与加载器同一条解析路径）`)
  }

  // ───────────────────────────── 4. 对比度（WCAG AA 4.5:1）

  const lum = (hex) => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }

  const PAIRS = [
    ['浅色 正文/底', '#141a1f', '#f4f7fa', 4.5],
    ['浅色 次要文字/白面板', '#3a454e', '#ffffff', 4.5],
    ['浅色 三级文字/白面板', '#5d6a75', '#ffffff', 4.5],
    ['浅色 品牌青金/白面板', '#39697a', '#ffffff', 4.5],
    ['浅色 按钮文字/品牌底', '#ffffff', '#39697a', 4.5],
    ['浅色 金线文字/白面板', '#a8892b', '#ffffff', 3.0],
    ['深色 正文/底', '#edf1f5', '#0c0f13', 4.5],
    ['深色 次要文字/面板', '#c2cbd5', '#141920', 4.5],
    ['深色 三级文字/面板', '#93a0ad', '#141920', 4.5],
    ['深色 品牌冰蓝/面板', '#8fc3d0', '#0c0f13', 4.5],
    ['深色 按钮文字/品牌底', '#0c0f13', '#8fc3d0', 4.5],
    ['深色 金色文字/面板', '#dfc078', '#141920', 4.5],
    // 新对话页抬头：26px 属大字，AA 门槛 3:1。
    // 取值为 color-mix(gold 84%, ink) 的近似结果。
    ['浅色 hero 抬头（大字）', '#907729', '#f4f7fa', 3.0],
    ['深色 hero 抬头（大字）', '#e1c88c', '#0c0f13', 3.0],
  ]
  const contrastFailures = []
  for (const [label, fg, bg, min] of PAIRS) {
    const ratio = contrast(fg, bg)
    if (ratio < min) contrastFailures.push(`${label}：${fg} on ${bg} = ${ratio.toFixed(2)}:1（需 ≥ ${min}）`)
  }
  if (contrastFailures.length) contrastFailures.forEach(fail)
  else note(`对比度：${PAIRS.length} 组前景/背景全部达标（WCAG AA）`)
}

// ───────────────────────────── 输出

const line = '─'.repeat(68)
console.log(line)
console.log(`皮肤自检：skin/  （id=${manifest?.id ?? '?'} v${manifest?.version ?? '?'}）`)
console.log(line)

for (const n of notes) console.log(`  · ${n}`)
for (const w of warnings) console.log(`  ⚠ ${w}`)
for (const p of problems) console.log(`  ✗ ${p}`)

console.log(line)
if (problems.length === 0) {
  console.log(`结果：通过（${warnings.length} 条告警，${notes.length} 条说明）`)
} else {
  console.log(`结果：失败（${problems.length} 条错误）`)
  process.exitCode = 1
}

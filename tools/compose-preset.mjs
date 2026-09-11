#!/usr/bin/env node
/**
 * compose-preset.mjs — 用「今汐」人格合成一份 DSH Agent 预设组合。
 *
 * 做法：取本机在线的 `standard` Agent 预设组合（@deepseek-ai/dsh-agent-presets），
 * **只替换其中的 `persona` 行**，其余顶层行（工具 / 技能 / 计划 / 目标 / 委派 / 压缩…）
 * 原样保留，写入目标 agent.cordis.yml。
 *
 * 为什么不整份随包分发：那份组合是 @deepseek-ai/dsh-agent-presets 的 MIT 内容，
 * 随包分发既涉及再分发，也会在 DSH 升级后变成过期副本。安装时现取最稳。
 *
 * 为什么不用 complete: true：那会让这个人格变成「完整系统提示」，
 * 顶掉 harness 自带的工具指引与运行时上下文，Agent 会失去全部工具纪律。
 *
 * 用法：
 *   node tools/compose-preset.mjs --out <agent.cordis.yml 路径>
 *   node tools/compose-preset.mjs --out <路径> --standard <standard 组合路径>
 *   node tools/compose-preset.mjs --check          # 只定位 standard 并报告
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PERSONA_FILE = join(ROOT, 'persona', 'system-prompt.txt')

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}
const CHECK_ONLY = process.argv.includes('--check')
const OUT = arg('out')
const STANDARD_OVERRIDE = arg('standard')

const DSH_HOME = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh')

/** 在若干候选位置里找出 standard 预设的 agent.cordis.yml。 */
function findStandard() {
  if (STANDARD_OVERRIDE) {
    return existsSync(STANDARD_OVERRIDE) ? STANDARD_OVERRIDE : null
  }
  const pnpmDir = join(DSH_HOME, 'profiles', 'web', 'node_modules', '.pnpm')
  const candidates = [
    join(pnpmDir, 'node_modules', '@deepseek-ai', 'dsh-agent-presets',
      'presets', 'standard', 'agent.cordis.yml'),
  ]
  // 版本化目录：@deepseek-ai+dsh-agent-presets@0.1.5-rc.1
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (!entry.startsWith('@deepseek-ai+dsh-agent-presets@')) continue
      candidates.push(join(pnpmDir, entry, 'node_modules', '@deepseek-ai', 'dsh-agent-presets',
        'presets', 'standard', 'agent.cordis.yml'))
    }
  }
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

/** 定位 js-yaml（agent-presets 的依赖），用于合成后的结构校验。 */
function loadYaml(standardPath) {
  // 从 standard 组合所在包往上找 node_modules
  const roots = [
    join(DSH_HOME, 'profiles', 'web', 'node_modules', '.pnpm', 'node_modules'),
    join(DSH_HOME, 'profiles', 'web', 'node_modules'),
  ]
  const pnpmDir = join(DSH_HOME, 'profiles', 'web', 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith('@deepseek-ai+dsh-agent-presets@')) {
        roots.unshift(join(pnpmDir, entry, 'node_modules'))
      }
      if (entry.startsWith('js-yaml@')) roots.unshift(join(pnpmDir, entry, 'node_modules'))
    }
  }
  if (standardPath) roots.unshift(dirname(dirname(dirname(standardPath))))

  for (const root of roots) {
    try {
      return createRequire(join(root, 'noop.js'))('js-yaml')
    } catch { /* 试下一个 */ }
  }
  return null
}

/**
 * 把组合里 `- id: persona` 那一行所在的分组整段替换掉。
 * 分组边界：从 `- id: persona` 到下一个顶层 `- id:`（或文件结尾）。
 */
function swapPersonaRow(composition, personaText) {
  const lines = composition.split(/\r?\n/)
  let start = -1
  let end = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (start === -1) {
      if (/^- id:\s*persona\s*$/.test(lines[i])) start = i
      continue
    }
    if (/^- id:/.test(lines[i])) { end = i; break }
  }

  if (start === -1) {
    throw new Error('在 standard 组合里找不到顶层 `- id: persona` 行——DSH 版本可能已变动')
  }

  // 使用 YAML 字面块标量（|-）：换行、冒号、引号、`{{…}}` 都安全，
  // 且不会被折叠成一行。
  const block = ['- id: persona', "  name: '@deepseek-ai/dsh-persona'", '  config:',
    '    suffix: Your working directory is {{cwd}}.', '    prefix: |-']

  const personaLines = personaText.replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n')
  for (const l of personaLines) {
    block.push(l.trim() === '' ? '' : '      ' + l)
  }

  const before = lines.slice(0, start)
  const after = lines.slice(end)
  return { text: [...before, ...block, ...after].join('\n') + '\n', start, end, replaced: end - start }
}

/** 结构校验：把 `!!js` 中和成普通标量后再解析，确认合成结果仍是合法 YAML 且 persona 已生效。 */
function validate(yaml, text, personaText) {
  if (yaml === null) return { parsed: false, reason: '未找到 js-yaml，跳过解析校验（已做文本级检查）' }

  const neutralized = text.replace(/!!js\s+/g, '')
  let doc
  try {
    doc = yaml.load(neutralized)
  } catch (err) {
    throw new Error(`合成结果不是合法 YAML：${err.message}`)
  }
  if (!Array.isArray(doc)) throw new Error('合成结果的顶层不是序列——组合结构已被破坏')

  const rows = doc.map((r) => r && r.id).filter(Boolean)
  const personaRow = doc.find((r) => r && r.id === 'persona')
  if (!personaRow) throw new Error('合成结果里没有 persona 行')
  if (personaRow.name !== '@deepseek-ai/dsh-persona') {
    throw new Error(`persona 行的 name 是 "${personaRow.name}"，期望 '@deepseek-ai/dsh-persona'`)
  }
  const prefix = personaRow.config?.prefix ?? ''
  if (typeof prefix !== 'string' || prefix.length < 200) {
    throw new Error('persona 行的 config.prefix 为空或过短，字面块标量可能没写对')
  }
  // 首尾各取一小段做内容比对，确认注入的确实是这份人格
  const probeHead = personaText.trim().split('\n')[0].trim()
  if (!prefix.includes(probeHead)) {
    throw new Error(`prefix 里找不到人格首行「${probeHead}」`)
  }
  if (personaRow.config?.complete === true) {
    throw new Error('persona 行带有 complete: true —— 会顶掉 harness 的工具指引，必须去掉')
  }
  return { parsed: true, rows }
}

function main() {
  const standard = findStandard()
  if (standard === null) {
    process.stderr.write(
      '找不到 standard Agent 预设组合。\n'
      + `已查找 DSH_HOME=${DSH_HOME} 下的 profiles/web/node_modules/.pnpm。\n`
      + '请用 --standard <路径> 指定，或确认 @deepseek-ai/dsh-agent-presets 已随 DSH 安装。\n')
    process.exitCode = 1
    return
  }
  console.log(`standard 组合：${standard}`)

  if (CHECK_ONLY) {
    const text = readFileSync(standard, 'utf8')
    const lines = text.split(/\r?\n/)
    const idx = lines.findIndex((l) => /^- id:\s*persona\s*$/.test(l))
    console.log(idx === -1 ? '  ⚠ 未找到 persona 行' : `  · persona 行在第 ${idx + 1} 行`)
    console.log(`  · 组合共 ${lines.length} 行`)
    return
  }

  if (!OUT) {
    process.stderr.write('缺少 --out <目标 agent.cordis.yml 路径>\n')
    process.exitCode = 1
    return
  }
  if (!existsSync(PERSONA_FILE)) {
    process.stderr.write(`缺少人格文件：${PERSONA_FILE}\n`)
    process.exitCode = 1
    return
  }

  const composition = readFileSync(standard, 'utf8')
  const personaText = readFileSync(PERSONA_FILE, 'utf8')
  const { text, replaced } = swapPersonaRow(composition, personaText)

  const result = validate(loadYaml(standard), text, personaText)

  const outAbs = resolve(OUT)
  mkdirSync(dirname(outAbs), { recursive: true })
  writeFileSync(outAbs, text, 'utf8')

  console.log(`  替换了 persona 分组（原 ${replaced} 行 → 新 ${personaText.trim().split('\n').length + 5} 行）`)
  if (result.parsed) {
    console.log(`  ✓ YAML 解析通过；顶层行：${result.rows.join(', ')}`)
    if (!result.rows.includes('agent-instructions')) {
      console.log('  ⚠ 组合里没有 agent-instructions —— 工具指引可能缺失，请人工确认')
    }
  } else {
    console.log(`  · ${result.reason}`)
  }
  console.log(`  ✓ 已写入 ${outAbs}`)
}

main()

#!/usr/bin/env node
/**
 * extract-jinhsi.mjs — 从 wuther.in 提取《鸣潮》角色「今汐」的全部文本，生成 corpus/。
 *
 * 数据来源（站点为 Next.js 应用，角色数据以静态 JSON 提供）：
 *   {site}/data/{version}/{lang}/character/{id}.json
 *   {site}/data/{version}/{lang}/character-story-voice/{id}.json
 *   {site}/data/{version}/{lang}/character/index.json
 *
 * 版本号与语言不写死：镜像站点源码的数据版本候选表逐个回退，首个可用即采用。
 *
 * 用法：
 *   node tools/extract-jinhsi.mjs            # 复用 corpus/raw 已存在的原始 JSON
 *   node tools/extract-jinhsi.mjs --refresh  # 强制重新下载
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CORPUS = join(ROOT, 'corpus')
const RAW = join(CORPUS, 'raw')

const SITE = 'https://wuther.in'
const CHARACTER_ID = 1304 // 今汐（由 character/index.json 核对：1304 今汐 衍射 5星）
const LANG = 'zh-Hans'
const SITE_DATA_VERSIONS = ['3.5.5', '3.5.4', '3.5.3', '3.4.13', '3.4.0', '3.3.12', '3.3.0', '3.2.0']

const REFRESH = process.argv.includes('--refresh')

// ────────────────────────────────────────────────────────────── 基础设施

const log = (msg) => process.stdout.write(msg + '\n')

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function tryFetch(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/** 按候选版本回退抓取一个数据文件；返回 { text, url, version } 或 null。 */
async function fetchData(relPath, candidates = SITE_DATA_VERSIONS) {
  for (const version of candidates) {
    const url = `${SITE}/data/${version}/${LANG}/${relPath}`
    const text = await tryFetch(url)
    if (text && text.trim().startsWith('{')) {
      return { text, url, version }
    }
  }
  return null
}

/** 抓取并缓存到 corpus/raw/；--refresh 时强制重下。 */
async function acquire(relPath, rawName, candidates) {
  const cachePath = join(RAW, rawName)
  if (!REFRESH && existsSync(cachePath)) {
    const text = readFileSync(cachePath, 'utf8')
    const from = await resolveSourceUrl(relPath, candidates)
    return { text, url: from.url, version: from.version, cached: true }
  }
  const fetched = await fetchData(relPath, candidates)
  if (!fetched) {
    throw new Error(`无法获取 ${relPath}（已尝试版本：${(candidates ?? SITE_DATA_VERSIONS).join(', ')}）`)
  }
  writeFileSync(cachePath, fetched.text, 'utf8')
  return { ...fetched, cached: false }
}

/** 仅用于给缓存文件标注来源；取不到时返回占位。 */
async function resolveSourceUrl(relPath, candidates) {
  for (const version of candidates ?? SITE_DATA_VERSIONS) {
    const url = `${SITE}/data/${version}/${LANG}/${relPath}`
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      if (res.ok) return { url, version }
    } catch {
      /* 忽略：离线时仍可使用缓存 */
    }
  }
  return { url: `${SITE}/data/{version}/${LANG}/${relPath}`, version: 'unknown' }
}

// ────────────────────────────────────────────── 站点富文本标记解码

/**
 * 解码站点富文本标记。返回 { text, terms }。
 * terms 收集 <te href=...> 引用的术语，供生成术语表。
 *
 * 站点标记形态：
 *   <size=40><color=Title>普攻</color></size>      标题
 *   <color=Highlight>X</color>                      强调
 *   <color=Light>衍射伤害</color>                    属性伤害着色
 *   <te href=850118>今州</te>                        术语引用
 *   <size=10> </size>                               占位空白
 *   {0} {1} ...                                     参数占位，取自 Param 数组（0 基）
 */
function richText(input, { params = [], hyperlinks = {}, terms = new Set(), heading = true } = {}) {
  if (typeof input !== 'string') return ''
  let s = input

  // 术语引用：取内文 + 记录术语键
  s = s.replace(/<te\s+href=(\d+)>(.*?)<\/te>/g, (_, key, inner) => {
    const name = hyperlinks[key]?.Name ?? inner
    terms.add(String(key))
    return inner.trim() || name
  })

  // 标题：<size=N><color=Title>X</color></size>
  s = s.replace(/<size=\d+>\s*<color=Title>(.*?)<\/color>\s*<\/size>/g, (_, title) => {
    const t = title.trim()
    return heading ? `\n\n#### ${t}\n\n` : `\n\n**${t}**\n\n`
  })

  // 强调
  s = s.replace(/<color=Highlight>(.*?)<\/color>/g, (_, inner) => `**${inner.trim()}**`)
  s = s.replace(/<color=Important>(.*?)<\/color>/g, (_, inner) => `**${inner.trim()}**`)

  // 其余着色（Light 等）：只保留内文
  s = s.replace(/<color=[A-Za-z]+>(.*?)<\/color>/g, (_, inner) => inner)

  // 残留的 size 标签与占位空白
  s = s.replace(/<size=\d+>\s*<\/size>/g, '')
  s = s.replace(/<\/?size=\d+>/g, '')

  // 参数占位 {0} {1} ...
  s = s.replace(/\{(\d+)\}/g, (whole, idx) => {
    const v = params[Number(idx)]
    return v === undefined || v === null ? whole : String(v)
  })

  // 规范化空白：保留段落换行
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return s
}

/** 把一条术语键解析成 "名称：释义" 行。 */
function termLine(key, hyperlinks) {
  const entry = hyperlinks[key]
  if (!entry) return `- \`${key}\` —（该术语不在角色数据内）`
  const name = entry.Name ?? key
  const desc = richText(entry.Desc ?? '', { params: entry.Param ?? [] })
  return `- **${name}** — ${desc || '（无释义）'}`
}

// ────────────────────────────────────────────────────── Markdown 助手

function h(level, text) {
  return `${'#'.repeat(level)} ${text}`
}

function table(headers, rows) {
  if (rows.length === 0) return '_（无数据）_\n'
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`)
  return [head, sep, ...body].join('\n') + '\n'
}

/** 生成每份语料文件头部的溯源块。 */
function provenance({ title, source, urls, generatedAt }) {
  const lines = [
    `<!-- 由 tools/extract-jinhsi.mjs 自动生成，请勿手工编辑 -->`,
    '',
    h(1, title),
    '',
    '| 项 | 值 |',
    '| --- | --- |',
    `| 角色 | 今汐（Jinhsi） · ID \`${CHARACTER_ID}\` |`,
    `| 数据来源 | ${source} |`,
    `| 数据版本 | \`${urls.version}\` |`,
    `| 语言 | \`${LANG}\` |`,
    `| 抓取时间 | ${generatedAt} |`,
    '',
  ]
  if (urls.list.length) {
    lines.push('数据文件：', '')
    for (const u of urls.list) lines.push(`- ${u}`)
    lines.push('')
  }
  lines.push('---', '')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────── 各章节渲染

function renderProfile(j, ctx) {
  const ci = j.CharaInfo ?? {}
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 角色档案', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]

  out.push(h(2, '基本身份'), '')
  out.push(table(['字段', '内容'], [
    ['姓名', j.Name],
    ['稀有度', `${j.Rarity} 星`],
    ['属性', j.Element?.Name],
    ['武器', j.Weapon?.Name],
    ['生日', ci.Birth],
    ['性别', ci.Sex],
    ['国家', ci.Country],
    ['势力', ci.Influence],
    ['异能名', ci.TalentName],
  ]), '')

  out.push(h(2, '角色简介'), '')
  out.push(richText(j.Desc ?? '', { hyperlinks: j.Hyperlink, terms }), '')

  if (ci.Info && richText(ci.Info, { hyperlinks: j.Hyperlink }) !== richText(j.Desc ?? '', { hyperlinks: j.Hyperlink })) {
    out.push(h(2, '档案描述'), '')
    out.push(richText(ci.Info, { hyperlinks: j.Hyperlink, terms }), '')
  }

  out.push(h(2, '频谱检验报告'), '')
  out.push(ci.TalentDoc ? richText(ci.TalentDoc, { hyperlinks: j.Hyperlink, terms }) : '_（无）_', '')
  if (ci.TalentCertification) {
    out.push(h(3, '诊断结果'), '')
    out.push(richText(ci.TalentCertification, { hyperlinks: j.Hyperlink, terms }), '')
  }

  out.push(h(2, '角色定位标签'), '')
  const tagRows = Object.values(j.Tag ?? {}).map((t) => [t.Name, t.Desc, `#${t.Color}`])
  out.push(table(['标签', '说明', '色值'], tagRows), '')

  out.push(h(2, '声优'), '')
  out.push(table(['语言', '声优'], [
    ['中文', ci.CVNameCn],
    ['日文', ci.CVNameJp],
    ['韩文', ci.CVNameKo],
    ['英文', ci.CVNameEn],
  ]), '')

  if (j.NickName && /存在异常|请联系官方客服/.test(j.NickName)) {
    out.push(h(2, '⚠️ 数据说明'), '')
    out.push(`源数据 \`NickName\` 字段的值为 \`${j.NickName}\`，这是站点/游戏客户端的**占位错误文案**，并非今汐的称号或设定，已从正文中剔除。`, '')
  }

  const termLines = [...terms].map((k) => termLine(k, j.Hyperlink))
  if (termLines.length) {
    out.push(h(2, '术语表（本文出现）'), '')
    out.push(termLines.join('\n'), '')
  }

  return out.join('\n')
}

function renderStats(j, ctx) {
  const out = [provenance({ title: '今汐 · 属性与突破', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]

  out.push(h(2, '基础属性成长'), '')
  out.push('下表的「阶段」为突破阶段（0 为未突破），等级为该阶段可达等级。', '')
  const rows = []
  const stats = j.Stats ?? {}
  const phases = Object.keys(stats).map(Number).sort((a, b) => a - b)
  for (const phase of phases) {
    const levels = Object.keys(stats[phase] ?? {}).map(Number).sort((a, b) => a - b)
    for (const lv of levels) {
      const s = stats[phase][lv]
      rows.push([phase, lv, s.Life, s.Atk, s.Def])
    }
  }
  out.push(table(['突破阶段', '等级', '生命', '攻击', '防御'], rows), '')

  if (j.BaseCombatStats && Object.keys(j.BaseCombatStats).length) {
    out.push(h(2, '基础战斗属性'), '')
    out.push('```json', JSON.stringify(j.BaseCombatStats, null, 2), '```', '')
  }

  if (j.AscensionsDetail) {
    out.push(h(2, '突破详情'), '')
    const ad = j.AscensionsDetail
    if (Array.isArray(ad)) {
      out.push('```json', JSON.stringify(ad, null, 2), '```', '')
    } else {
      out.push('```json', JSON.stringify(ad, null, 2), '```', '')
    }
  }

  if (j.LevelEXP) {
    out.push(h(2, '等级经验'), '')
    out.push('```json', JSON.stringify(j.LevelEXP, null, 2), '```', '')
  }

  return out.join('\n')
}

const NODE_TYPE_NAME = {
  1: '共鸣解放',
  2: '技能（可升级）',
  3: '固有技能',
  4: '属性加成',
}

function renderSkills(j, ctx) {
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 技能', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]

  out.push(h(2, '技能树总览'), '')
  const overview = Object.entries(j.SkillTrees ?? {}).map(([key, node]) => [
    key, node.Skill?.Name ?? `（节点 ${key}）`, NODE_TYPE_NAME[node.NodeType] ?? `类型 ${node.NodeType}`,
  ])
  out.push(table(['节点', '名称', '类别'], overview), '')

  const ri = j.RoleSkillInput
  if (ri) {
    out.push(h(2, '技能机制说明'), '')
    for (const line of ri.DescList ?? []) {
      out.push(`- ${richText(line, { hyperlinks: j.Hyperlink, terms })}`)
    }
    out.push('')
    if (ri.SkillInputList && Object.keys(ri.SkillInputList).length) {
      out.push(h(3, '操作输入'), '')
      for (const [key, entry] of Object.entries(ri.SkillInputList)) {
        out.push(`- **${key}** — ${richText(entry.Desc ?? '', { params: entry.InputList ?? [], hyperlinks: j.Hyperlink, terms })}`)
      }
      out.push('')
    }
  }

  for (const [key, node] of Object.entries(j.SkillTrees ?? {})) {
    const skill = node.Skill ?? {}
    out.push(h(2, `${key}. ${skill.Name ?? '（未命名）'}`), '')
    out.push(`- 类别：${NODE_TYPE_NAME[node.NodeType] ?? `类型 ${node.NodeType}`}`)
    out.push(`- 技能类型：${skill.Type ?? '—'}`)
    out.push('')

    if (skill.Desc) {
      out.push(h(3, '技能描述'), '')
      out.push(richText(skill.Desc, { params: skill.Param ?? [], hyperlinks: j.Hyperlink, terms }), '')
    }
    if (skill.SimpleDesc && skill.SimpleDesc !== skill.Desc) {
      out.push(h(3, '简略描述'), '')
      out.push(richText(skill.SimpleDesc, { params: skill.SimpleParam ?? [], hyperlinks: j.Hyperlink, terms }), '')
    }
    if (node.Desc) {
      out.push(h(3, '节点说明'), '')
      out.push(richText(node.Desc, { params: node.Param ?? [], hyperlinks: j.Hyperlink, terms }), '')
    }

    if (node.Level && typeof node.Level === 'object') {
      const entries = Object.entries(node.Level)
      if (entries.length && typeof entries[0][1] !== 'object') {
        out.push(h(3, '等级数值'), '')
        out.push(table(['等级', '数值'], entries.map(([lv, v]) => [lv, v])), '')
      }
    }
    if (node.Damage && typeof node.Damage === 'object') {
      out.push(h(3, '伤害倍率'), '')
      out.push('```json', JSON.stringify(node.Damage, null, 2), '```', '')
    }
    if (Array.isArray(node.ConsumeDetail) && node.ConsumeDetail.length) {
      out.push(h(3, '升级材料'), '')
      out.push(table(['材料', '数量'], node.ConsumeDetail.map((c) => [
        j.ConsumeItems?.[String(c.Id)]?.Name ?? `\`${c.Id}\``, c.Count,
      ])), '')
    }
  }

  const termLines = [...terms].map((k) => termLine(k, j.Hyperlink))
  if (termLines.length) {
    out.push(h(2, '术语表（本文出现）'), '')
    out.push(termLines.join('\n'), '')
  }

  return out.join('\n')
}

function renderChains(j, ctx) {
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 共鸣链', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]
  out.push('共鸣链共 6 段，按 `Chains` 键序排列。', '')

  for (const [key, chain] of Object.entries(j.Chains ?? {})) {
    out.push(h(2, `第 ${key} 段 · ${chain.Name ?? '（未命名）'}`), '')
    if (chain.Desc) {
      out.push(richText(chain.Desc, { params: chain.Param ?? [], hyperlinks: j.Hyperlink, terms }), '')
    }
    if (Array.isArray(chain.Param) && chain.Param.length) {
      out.push('', `参数：\`${chain.Param.join('`, `')}\``, '')
    }
  }

  const termLines = [...terms].map((k) => termLine(k, j.Hyperlink))
  if (termLines.length) {
    out.push(h(2, '术语表（本文出现）'), '')
    out.push(termLines.join('\n'), '')
  }

  return out.join('\n')
}

function renderStories(sv, ctx) {
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 角色故事', source: '角色故事与语音（character-story-voice）', urls: ctx.urls, generatedAt: ctx.generatedAt })]
  out.push(`共 ${sv.Stories?.length ?? 0} 篇，全文照录，未作删节。`, '')

  for (const [i, story] of (sv.Stories ?? []).entries()) {
    out.push(h(2, `${i + 1}. ${story.Title}`), '')
    out.push(richText(story.Content ?? '', { hyperlinks: sv.Hyperlink ?? {}, terms }), '')
  }

  return out.join('\n')
}

const VOICE_GROUP = {
  1: '关于与心声（档案类）',
  2: '战斗与操作（实战类）',
}

function renderVoices(sv, ctx) {
  const out = [provenance({ title: '今汐 · 语音', source: '角色故事与语音（character-story-voice）', urls: ctx.urls, generatedAt: ctx.generatedAt })]
  const voices = sv.Voices ?? []
  out.push(`共 ${voices.length} 条，按站点 \`Type\` 字段分组，站内顺序保留。`, '')

  const groups = new Map()
  for (const v of voices) {
    const t = v.Type ?? 0
    if (!groups.has(t)) groups.set(t, [])
    groups.get(t).push(v)
  }

  for (const [type, list] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    out.push(h(2, `${VOICE_GROUP[type] ?? `其他（Type ${type}）`} · ${list.length} 条`), '')
    for (const [i, v] of list.entries()) {
      out.push(h(3, `${i + 1}. ${v.Title}`), '')
      out.push(richText(v.Content ?? '', { hyperlinks: sv.Hyperlink ?? {} }), '')
      if (v.Voice) {
        out.push('', `<sub>音频事件：\`${v.Voice}\`</sub>`, '')
      }
    }
  }

  return out.join('\n')
}

function renderWardrobe(j, ctx) {
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 服饰与藏品', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]

  out.push(h(2, '服饰 / 皮肤'), '')
  for (const [key, skin] of Object.entries(j.Skin ?? {})) {
    out.push(h(3, `${skin.TitleName ?? skin.Name}（${skin.SubDecName ?? key}）`), '')
    out.push(table(['字段', '值'], [
      ['皮肤 ID', skin.Id],
      ['品质', skin.QualityId],
      ['名称', skin.Name],
      ['标题', skin.TitleName],
      ['副标题', skin.SubDecName],
    ]), '')
    if (skin.BgDescription) {
      out.push('**描述**', '', richText(skin.BgDescription, { hyperlinks: j.Hyperlink, terms }), '')
    }
  }

  out.push(h(2, '角色藏品'), '')
  for (const [i, good] of (j.Goods ?? []).entries()) {
    out.push(h(3, `${i + 1}. ${good.Title}`), '')
    out.push(richText(good.Content ?? '', { hyperlinks: j.Hyperlink, terms }), '')
  }

  if (j.SpecialCook) {
    out.push(h(2, '专属料理'), '')
    out.push(h(3, j.SpecialCook.Name), '')
    out.push(richText(j.SpecialCook.Desc ?? '', { hyperlinks: j.Hyperlink, terms }), '')
  }

  const termLines = [...terms].map((k) => termLine(k, j.Hyperlink))
  if (termLines.length) {
    out.push(h(2, '术语表（本文出现）'), '')
    out.push(termLines.join('\n'), '')
  }

  return out.join('\n')
}

function renderBuild(j, ctx) {
  const terms = new Set()
  const out = [provenance({ title: '今汐 · 养成材料与配装', source: '角色数据（character）', urls: ctx.urls, generatedAt: ctx.generatedAt })]
  const rdp = j.RoleDevProject ?? {}

  out.push(h(2, '推荐武器'), '')
  const weapons = rdp.RecommandWeaponDetail ?? []
  out.push(table(['武器', 'ID', '副属性', '副属性值'], weapons.map((w) => [
    w.Name, w.Id, w.SubStatName, w.SubStatValueText,
  ])), '')

  out.push(h(2, '养成材料总表'), '')
  const items = j.ConsumeItems ?? {}
  out.push(table(['材料 ID', '名称'], Object.entries(items).map(([id, v]) => [`\`${id}\``, v.Name])), '')

  out.push(h(2, '各技能节点材料消耗'), '')
  out.push(table(['节点', '技能', '材料', '数量'], Object.entries(j.SkillTrees ?? {}).flatMap(([key, node]) =>
    (node.ConsumeDetail ?? []).map((c) => [key, node.Skill?.Name ?? '', items[String(c.Id)]?.Name ?? `\`${c.Id}\``, c.Count]),
  )), '')

  const termLines = [...terms].map((k) => termLine(k, j.Hyperlink))
  if (termLines.length) {
    out.push(h(2, '术语表（本文出现）'), '')
    out.push(termLines.join('\n'), '')
  }

  return out.join('\n')
}

function renderIndex({ j, sv, ctx, files }) {
  const out = [provenance({ title: '今汐 · 语料索引', source: '角色数据 + 角色故事与语音', urls: ctx.urls, generatedAt: ctx.generatedAt })]

  out.push(h(2, '数据规模'), '')
  out.push(table(['项目', '数量', '所在文件'], [
    ['角色档案字段', Object.keys(j).length, '`01-角色档案.md`'],
    ['成长属性条目', Object.values(j.Stats ?? {}).reduce((n, p) => n + Object.keys(p).length, 0), '`02-属性与突破.md`'],
    ['技能树节点', Object.keys(j.SkillTrees ?? {}).length, '`03-技能.md`'],
    ['共鸣链', Object.keys(j.Chains ?? {}).length, '`04-共鸣链.md`'],
    ['角色故事', sv.Stories?.length ?? 0, '`05-角色故事.md`'],
    ['语音条目', sv.Voices?.length ?? 0, '`06-语音.md`'],
    ['服饰 / 皮肤', Object.keys(j.Skin ?? {}).length, '`07-服饰与藏品.md`'],
    ['角色藏品', j.Goods?.length ?? 0, '`07-服饰与藏品.md`'],
    ['养成材料条目', Object.keys(j.ConsumeItems ?? {}).length, '`08-养成材料与配装.md`'],
  ]), '')

  out.push(h(2, '文件导航'), '')
  out.push(table(['文件', '内容'], files.map((f) => [`\`${f.name}\``, f.summary])), '')

  out.push(h(2, '原始数据'), '')
  out.push(table(['文件', '字节数', 'SHA-256'], ctx.rawFiles.map((r) => [
    `\`${r.name}\``, r.bytes, `\`${r.sha256.slice(0, 16)}…\``,
  ])), '')

  out.push(h(2, '解码约定'), '')
  out.push([
    '源数据使用站点私有富文本标记，本语料已按下列规则解码：',
    '',
    table(['原始标记', '含义', '输出'], [
      ['`<te href=850118>今州</te>`', '术语引用', '内文 + 文末术语表'],
      ['`<size=40><color=Title>普攻</color></size>`', '小节标题', '`#### 普攻`'],
      ['`<color=Highlight>X</color>`', '强调', '`**X**`'],
      ['`<color=Light>衍射伤害</color>`', '属性伤害着色', '保留内文'],
      ['`{0}` `{1}` …', '参数占位', '按 `Param[n]` 展开（0 基）'],
    ]),
    '',
  ].join('\n'))

  out.push(h(2, '重新生成'), '')
  out.push('```sh', 'node tools/extract-jinhsi.mjs            # 复用 corpus/raw 缓存', 'node tools/extract-jinhsi.mjs --refresh  # 强制重新下载', '```', '')
  out.push('若站点结构变动，脚本会尝试 `' + SITE_DATA_VERSIONS.join('`, `') + '` 全部候选版本；字段缺失时对应章节显式标注，不会静默跳过。', '')

  return out.join('\n')
}

// ──────────────────────────────────────────────────────────── 主流程

async function main() {
  mkdirSync(RAW, { recursive: true })

  log('[1/4] 抓取角色数据 …')
  const character = await acquire('character/1304.json', 'character-1304.json')
  const storyVoice = await acquire('character-story-voice/1304.json', 'character-story-voice-1304.json')

  let j, sv
  try {
    j = JSON.parse(character.text)
  } catch (err) {
    throw new Error(`character/1304.json 解析失败：${err.message}`)
  }
  try {
    sv = JSON.parse(storyVoice.text)
  } catch (err) {
    throw new Error(`character-story-voice/1304.json 解析失败：${err.message}`)
  }

  if (j.Name !== '今汐') {
    throw new Error(`角色 ID ${CHARACTER_ID} 的名称为「${j.Name}」，预期「今汐」——站点数据可能已变动，请核对 ID。`)
  }
  log(`      角色：${j.Name} · ${j.Element?.Name} · ${j.Rarity}星 · 数据版本 ${character.version}`)

  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const ctx = {
    generatedAt,
    urls: { version: character.version, list: [character.url, storyVoice.url] },
    rawFiles: [],
  }

  log('[2/4] 渲染章节 …')
  const chapters = [
    { file: '01-角色档案.md', summary: '身份、简介、频谱检验报告、标签、声优', build: () => renderProfile(j, ctx) },
    { file: '02-属性与突破.md', summary: '三维成长表、基础战斗属性、突破与等级经验', build: () => renderStats(j, ctx) },
    { file: '03-技能.md', summary: '技能树 17 节点全文、机制说明、操作输入、升级材料', build: () => renderSkills(j, ctx) },
    { file: '04-共鸣链.md', summary: '共鸣链 6 段全文', build: () => renderChains(j, ctx) },
    { file: '05-角色故事.md', summary: '角色故事全文', build: () => renderStories(sv, ctx) },
    { file: '06-语音.md', summary: '语音全文，按档案类 / 实战类分组', build: () => renderVoices(sv, ctx) },
    { file: '07-服饰与藏品.md', summary: '服饰描述、角色藏品、专属料理', build: () => renderWardrobe(j, ctx) },
    { file: '08-养成材料与配装.md', summary: '推荐武器、材料总表、各节点消耗', build: () => renderBuild(j, ctx) },
  ]

  for (const ch of chapters) {
    const text = ch.build()
    writeFileSync(join(CORPUS, ch.file), text, 'utf8')
    log(`      ${ch.file}  ${text.length} 字符`)
  }

  // 原始文件指纹（在 index 之前算好，索引里要引用）
  for (const [name, holder] of [['character-1304.json', character], ['character-story-voice-1304.json', storyVoice]]) {
    ctx.rawFiles.push({
      name,
      bytes: Buffer.byteLength(holder.text, 'utf8'),
      sha256: sha256(holder.text),
    })
  }

  log('[3/4] 生成索引 …')
  const indexText = renderIndex({ j, sv, ctx, files: chapters })
  writeFileSync(join(CORPUS, '00-索引.md'), indexText, 'utf8')
  log(`      00-索引.md  ${indexText.length} 字符`)

  log('[4/4] 自检 …')
  const chaptersOnly = chapters.map((c) => c.file)
  const all = ['00-索引.md', ...chaptersOnly]
    .map((f) => ({ f, text: readFileSync(join(CORPUS, f), 'utf8') }))

  // 扫描前剔除代码块与行内代码：索引文件用它们「记录」标记语法，不是未解码残留。
  const scannable = all
    .filter(({ f }) => chaptersOnly.includes(f))
    .map(({ f, text }) => ({
      f,
      text: text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, ''),
    }))

  // 断言 1：{n} 占位符必须全部展开
  const leftover = scannable.flatMap(({ f, text }) =>
    [...text.matchAll(/\{\d+\}/g)].map((m) => `${f}: ${m[0]}`),
  )
  if (leftover.length) {
    log(`      ⚠ 仍有未展开的占位符 ${leftover.length} 处：${leftover.slice(0, 8).join(', ')}`)
  } else {
    log('      ✓ 参数占位符已全部展开')
  }

  // 断言 2：富文本标签不得残留
  const tagLeft = scannable.flatMap(({ f, text }) =>
    [...text.matchAll(/<\/?(?:te|color|size)\b[^>]*>/g)].map((m) => `${f}: ${m[0]}`),
  )
  if (tagLeft.length) {
    log(`      ⚠ 仍有未解码标签 ${tagLeft.length} 处：${tagLeft.slice(0, 8).join(', ')}`)
  } else {
    log('      ✓ 富文本标签已全部解码')
  }

  // 断言 3：条目数与源数据一致
  const checks = [
    ['角色故事', sv.Stories?.length ?? 0],
    ['语音', sv.Voices?.length ?? 0],
    ['技能树节点', Object.keys(j.SkillTrees ?? {}).length],
    ['共鸣链', Object.keys(j.Chains ?? {}).length],
    ['服饰', Object.keys(j.Skin ?? {}).length],
    ['藏品', j.Goods?.length ?? 0],
  ]
  log('      ✓ 条目数：' + checks.map(([k, v]) => `${k} ${v}`).join(' / '))

  // 断言 4：每篇故事 / 每条语音的正文都能在语料里找到
  const storyText = readFileSync(join(CORPUS, '05-角色故事.md'), 'utf8')
  const voiceText = readFileSync(join(CORPUS, '06-语音.md'), 'utf8')
  const missingStories = (sv.Stories ?? []).filter((s) => {
    const probe = richText(s.Content ?? '').slice(0, 24)
    return probe.length > 8 && !storyText.includes(probe.replace(/\n/g, '\n'))
  })
  const missingVoices = (sv.Voices ?? []).filter((v) => {
    const probe = richText(v.Content ?? '').slice(0, 24)
    return probe.length > 6 && !voiceText.includes(probe)
  })
  log(missingStories.length === 0
    ? '      ✓ 角色故事全文比对通过'
    : `      ⚠ ${missingStories.length} 篇故事未能全文匹配：${missingStories.map((s) => s.Title).join(', ')}`)
  log(missingVoices.length === 0
    ? '      ✓ 语音全文比对通过'
    : `      ⚠ ${missingVoices.length} 条语音未能全文匹配`)

  log('')
  log(`完成。语料目录：${CORPUS}`)
}

main().catch((err) => {
  process.stderr.write(`提取失败：${err.message}\n`)
  process.exitCode = 1
})

#!/usr/bin/env node
/**
 * dsh-jinhsi-skin 自检 —— 皮肤插件契约的离线验证。
 *
 * 这个包只做一件事：把 `skin/` 同步到 `$DSH_HOME/skins/<id>/`。渲染器（皮肤中心，
 * 也是壁纸所在）是**可选依赖**：装不装由使用者决定，所以这里要钉死两件事——
 *
 *   1. 皮肤中心必须是 optional peer，不能是 dependencies / optionalDependencies：
 *      否则装皮肤时会被动把它拉进来，"自选"就是假的。
 *   2. bundle patch 里**不能出现**皮肤中心那一行：包没装时那一行会解析不到，
 *      dsh 启动是 fail-loud 的，会直接把 GUI 拖垮。装了皮肤中心，它自己的 bundle
 *      会插自己那一行。
 *
 * 用法：
 *   node tools/verify-standalone.mjs              # 全部检查
 *   node tools/verify-standalone.mjs --keep-tmp   # 保留沙箱目录，便于人工查看
 *
 * 全程离线：同步测试把包复制到临时目录、并抹掉来源表里的 sha256，
 * 于是 fetchMissingAssets 判定「不缺」而不会联网。
 */

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIN_ID = 'jinhsi-spectro'
const SKIN_CENTER = '@linxin666/dsh-client-ui-skin-center'

const keepTmp = process.argv.includes('--keep-tmp')
const failures = []
const notes = []

function check(label, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail === '' ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(label)
}

function note(label, detail) {
  notes.push(`${label}：${detail}`)
  console.log(` note  ${label} — ${detail}`)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

/**
 * 极简 patch 解析：只认本仓库这份 patch 用到的两种行
 * （`- id: X` 与紧随其后的 `name: Y`）。刻意不引 YAML 依赖。
 */
function parsePatch(path) {
  const rows = []
  let current = null
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/u, '')
    const id = /^\s*-\s*id:\s*(.+?)\s*$/u.exec(line)
    if (id !== null) {
      current = { id: id[1].replace(/^['"]|['"]$/gu, ''), name: null, disabled: null }
      rows.push(current)
      continue
    }
    if (current === null) continue
    const name = /^\s*name:\s*(.+?)\s*$/u.exec(line)
    if (name !== null) {
      current.name = name[1].replace(/^['"]|['"]$/gu, '')
      continue
    }
    const disabled = /^\s*disabled:\s*(true|false)\s*$/u.exec(line)
    if (disabled !== null) current.disabled = disabled[1] === 'true'
  }
  return rows
}

/** 造一个合法的空 WebP 头，用来冒充「本机已下载的官方美术」。 */
function fakeWebp(tag) {
  const stamp = Buffer.from(`FAKE-${tag}`.padEnd(16, '.'), 'ascii')
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBP', 'ascii'), stamp])
}

console.log(`\n== dsh-jinhsi-skin 自检 ==\n包目录：${PKG_ROOT}\n`)

// ---------------------------------------------------------------- 1. 包结构
console.log('[1] 包结构')
const pkgPath = join(PKG_ROOT, 'package.json')
const patchPath = join(PKG_ROOT, 'cordis.patch.yml')
const libPath = join(PKG_ROOT, 'lib', 'index.js')
const skinSrc = join(PKG_ROOT, 'skin')
check('package.json 存在', existsSync(pkgPath))
check('cordis.patch.yml 存在', existsSync(patchPath))
check('lib/index.js 存在', existsSync(libPath))
check('skin/skin.json 存在', existsSync(join(skinSrc, 'skin.json')))

if (!existsSync(pkgPath) || !existsSync(patchPath) || !existsSync(libPath)) {
  console.log('\n包不完整，后续检查无法进行。')
  process.exit(1)
}

const pkg = readJson(pkgPath)
check('package.json 可解析', pkg !== null)
check('包名是 dsh-jinhsi-skin', pkg.name === 'dsh-jinhsi-skin', String(pkg.name))
check('dsh.bundle.patch 指向包内 patch',
  pkg.dsh?.bundle?.patch === './cordis.patch.yml',
  String(pkg.dsh?.bundle?.patch))
check('main 指向 lib/index.js', pkg.main === './lib/index.js', String(pkg.main))

// ------------------------------------------------- 2. 皮肤中心 = 可选依赖
console.log('\n[2] 皮肤中心是「可选」依赖（选择权在使用者）')
const peer = pkg.peerDependencies?.[SKIN_CENTER]
const peerOptional = pkg.peerDependenciesMeta?.[SKIN_CENTER]?.optional === true
const inDeps = pkg.dependencies?.[SKIN_CENTER]
const inOptionalDeps = pkg.optionalDependencies?.[SKIN_CENTER]
check('声明为 peerDependency', typeof peer === 'string', peer === undefined ? '未声明' : `范围 ${peer}`)
check('并标记为 optional', peerOptional, `peerDependenciesMeta.optional=${String(pkg.peerDependenciesMeta?.[SKIN_CENTER]?.optional)}`)
check('不在 dependencies（否则装皮肤时会被动装上）', inDeps === undefined, inDeps === undefined ? '' : `dependencies=${inDeps}`)
check('不在 optionalDependencies（那是「装但允许失败」，不是自选）', inOptionalDeps === undefined,
  inOptionalDeps === undefined ? '' : `optionalDependencies=${inOptionalDeps}`)

// 本机是否装了皮肤中心：只是信息，两个分支都必须能通过自检
const installedCenter = [join(PKG_ROOT, 'node_modules', SKIN_CENTER), resolve(PKG_ROOT, '..', 'node_modules', SKIN_CENTER)]
  .find((p) => existsSync(join(p, 'package.json')))
if (installedCenter !== undefined) {
  const centerPkg = readJson(join(installedCenter, 'package.json'))
  note('本机已装皮肤中心', `${centerPkg?.name ?? '?'}@${centerPkg?.version ?? '?'} → 渲染器与壁纸可用`)
  check('皮肤中心导出 ./client（浏览器半区）',
    typeof centerPkg?.exports?.['./client'] === 'string',
    String(centerPkg?.exports?.['./client']))
} else {
  note('本机未装皮肤中心', '皮肤会照常同步到用户皮肤目录，等有渲染器时生效')
}

// ------------------------------------------------------ 3. patch 只有一行
console.log('\n[3] cordis.patch.yml（只挂皮肤同步，不引用可选依赖）')
const rows = parsePatch(patchPath)
check('正好一行', rows.length === 1, `${rows.length} 行`)
const hostRow = rows[0]
check('这一行挂的是本包', hostRow?.name === 'dsh-jinhsi-skin', String(hostRow?.name))
check('未被默认停用', hostRow?.disabled !== true)
check('patch 里不出现皮肤中心（包没装时那一行会解析不到、启动 fail-loud）',
  !readFileSync(patchPath, 'utf8').split(/\r?\n/).some((l) => /^\s*-?\s*name:\s*['"]?@linxin666\/dsh-client-ui-skin-center/u.test(l)))

// ----------------------------------------------------------- 4. 皮肤本体
console.log('\n[4] 皮肤本体（skin/）')
const manifest = readJson(join(skinSrc, 'skin.json'))
const sources = readJson(join(PKG_ROOT, 'tools', 'asset-sources.json'))
check('skin.json 可解析', manifest !== null)
check(`皮肤 id 是 ${SKIN_ID}`, manifest?.id === SKIN_ID, String(manifest?.id))
check('manifest v2', manifest?.skinManifestVersion === 2, String(manifest?.skinManifestVersion))
check('tools/asset-sources.json 可解析', sources !== null)

// 随包分发的文件：必须在 skin/ 里。
const shipped = [
  ['contributes.stylesheet', manifest?.contributes?.stylesheet],
  ['contributes.patches', manifest?.contributes?.patches],
  ['preview.light', manifest?.preview?.light],
  ['preview.dark', manifest?.preview?.dark],
  // v1.4.0 起背景媒体也是随包分发的（动态壁纸导出件，见 NOTICE），
  // 所以它和样式表一样必须在包里 —— 别的机器装了不能没有底图。
  ['backgroundMedia.light.src', manifest?.contributes?.backgroundMedia?.light?.src],
  ['backgroundMedia.dark.src', manifest?.contributes?.backgroundMedia?.dark?.src],
]
for (const [label, rel] of shipped) {
  check(`${label} → ${rel ?? '(缺失)'}`,
    typeof rel === 'string' && rel !== '' && existsSync(join(skinSrc, rel)))
}

// 运行期取回的文件（官方头像等，版权归库洛游戏，不随包分发）：
// 只要求来源表里有它、安装时能落到 skin/assets/；包内没有是**预期**，不是缺陷。
for (const asset of sources?.assets ?? []) {
  check(`来源表 ${asset.file}（安装时取回）`,
    typeof asset.file === 'string' && asset.file !== ''
      && (typeof asset.url === 'string' || typeof asset.path === 'string'),
    asset.optional === true ? '备用，缺失无害' : '必需')
}
if (manifest?.version !== undefined) {
  note('皮肤内容版本', `v${manifest.version}（改动皮肤内容时才需要提升；插件版本看 package.json v${pkg.version}）`)
}

// --------------------------------------------------- 5. 同步（沙箱、离线）
console.log('\n[5] 皮肤同步（临时 DSH_SKINS_HOME，离线）')
const tmpRoot = mkdtempSync(join(tmpdir(), 'dsh-jinhsi-skin-verify-'))

try {
  // 复制一份包到临时目录：把来源表里的 sha256 抹掉，同步就判定「本机已有 = 不缺」，
  // 因此整条路径都不联网，检查的是同步本身（保留、幂等、原子发布），而不是网络。
  const sandboxPkg = join(tmpRoot, 'pkg')
  mkdirSync(sandboxPkg, { recursive: true })
  writeFileSync(join(sandboxPkg, 'package.json'), JSON.stringify({ name: 'dsh-jinhsi-skin', type: 'module' }))
  cpSync(join(PKG_ROOT, 'lib'), join(sandboxPkg, 'lib'), { recursive: true })
  cpSync(skinSrc, join(sandboxPkg, 'skin'), { recursive: true })
  mkdirSync(join(sandboxPkg, 'tools'), { recursive: true })
  const sandboxSources = JSON.parse(JSON.stringify(sources))
  for (const asset of sandboxSources.assets ?? []) delete asset.sha256
  writeFileSync(join(sandboxPkg, 'tools', 'asset-sources.json'), JSON.stringify(sandboxSources, null, 2))
  // 沙箱要代表**发布出去的那个包**：官方美术不随包分发，所以把本机为生成预览
  // 临时放进 skin/assets 的那几份也剔掉，否则「保留本机美术」根本无从检验。
  for (const asset of sources?.assets ?? []) {
    rmSync(join(sandboxPkg, 'skin', 'assets', asset.file), { force: true })
  }

  process.env.DSH_SKINS_HOME = join(tmpRoot, 'skins')
  const dest = join(process.env.DSH_SKINS_HOME, SKIN_ID)
  const required = (sandboxSources.assets ?? []).filter((a) => a.optional !== true)
  check('来源表有必需美术条目', required.length > 0, `${required.length} 项`)

  // 预置「本机已下载」的官方美术 + 一个旧版本标记，逼出一次真实同步
  mkdirSync(join(dest, 'assets'), { recursive: true })
  const seeded = new Map()
  for (const asset of required) {
    const buf = fakeWebp(asset.file)
    writeFileSync(join(dest, 'assets', asset.file), buf)
    seeded.set(asset.file, buf)
  }
  writeFileSync(join(dest, '.dsh-jinhsi-skin.json'),
    JSON.stringify({ id: SKIN_ID, version: '0.0.0-sandbox', installedBy: 'verify' }, null, 2))
  // 本机已生成过的「真实预览」不能被仓库那份占位预览盖回去。
  mkdirSync(join(dest, 'preview'), { recursive: true })
  const realPreview = Buffer.from('LOCAL-REAL-PREVIEW')
  writeFileSync(join(dest, 'preview', 'light.jpg'), realPreview)

  const logs = []
  const log = {
    info: (m) => logs.push(`info ${m}`),
    warn: (m) => logs.push(`warn ${m}`),
    error: (m) => logs.push(`error ${m}`),
  }

  const { syncSkin, userSkinsDir } = await import(pathToFileURL(join(sandboxPkg, 'lib', 'index.js')).href)
  check('DSH_SKINS_HOME 被尊重', userSkinsDir() === resolve(process.env.DSH_SKINS_HOME), userSkinsDir())

  const published = await syncSkin(log)
  check('同步返回发布目录', published === dest, String(published))
  check('皮肤已发布（skin.json 落地）', existsSync(join(dest, 'skin.json')))
  check('样式表已发布', existsSync(join(dest, manifest?.contributes?.stylesheet ?? 'skin.css')))
  check('补丁样式表已发布', existsSync(join(dest, manifest?.contributes?.patches ?? 'patches.css')))

  const marker = readJson(join(dest, '.dsh-jinhsi-skin.json'))
  check('标记文件写入且版本与 manifest 一致',
    marker?.version === manifest?.version,
    `marker=${marker?.version} manifest=${manifest?.version}`)

  let preserved = 0
  for (const [file, buf] of seeded) {
    const path = join(dest, 'assets', file)
    if (existsSync(path) && Buffer.compare(readFileSync(path), buf) === 0) preserved += 1
  }
  check('本机已有官方美术未被同步抹掉', preserved === seeded.size, `${preserved}/${seeded.size} 保留`)
  check('本机已生成的真实预览未被包内占位版盖回去',
    Buffer.compare(readFileSync(join(dest, 'preview', 'light.jpg')), realPreview) === 0)
  check('同步过程没有告警/错误', !logs.some((l) => l.startsWith('warn') || l.startsWith('error')),
    logs.filter((l) => !l.startsWith('info')).join(' | ') || '无')

  // 幂等：版本一致时不应重新发布（放一个哨兵文件，看它还在不在）。
  const sentinel = join(dest, '.sentinel')
  writeFileSync(sentinel, 'keep')
  const before = statSync(join(dest, 'skin.json')).mtimeMs
  const again = await syncSkin(log)
  check('二次同步幂等（返回同一目录）', again === dest)
  check('二次同步未重新发布（哨兵仍在）', existsSync(sentinel))
  check('二次同步未改写 skin.json', statSync(join(dest, 'skin.json')).mtimeMs === before)

  // 陈旧替换 + 取回失败：来源表写了 sha256 而本机文件对不上时必须判为「缺」并尝试
  // 重新获取；取回失败也不能把本机文件删掉——离线时背景不该凭空消失。
  // 这一项刻意留一个永远对不上的 sha256，并把 url 指到取不到的 file://，
  // 于是 fetch 立刻失败（有界重试），全程仍然不联网。
  const staleAsset = required[0]
  const stalePath = join(dest, 'assets', staleAsset.file)
  writeFileSync(stalePath, Buffer.concat([fakeWebp('stale'), Buffer.from([0])]))
  sandboxSources.assets = sandboxSources.assets.map((a) => (a.file === staleAsset.file
    ? { ...a, sha256: 'deadbeef'.repeat(8), url: 'file:///definitely-not-here/none.jpg' }
    : a))
  writeFileSync(join(sandboxPkg, 'tools', 'asset-sources.json'), JSON.stringify(sandboxSources, null, 2))
  rmSync(join(dest, '.dsh-jinhsi-skin.json'), { force: true })

  const staleLogs = []
  const staleLog = {
    info: (m) => staleLogs.push(`info ${m}`),
    warn: (m) => staleLogs.push(`warn ${m}`),
    error: (m) => staleLogs.push(`error ${m}`),
  }
  await syncSkin(staleLog)
  check('sha256 对不上时被判定为需要重新获取',
    staleLogs.some((l) => l.startsWith('info') && /缺失 1 项/u.test(l)),
    staleLogs.filter((l) => l.startsWith('info')).slice(0, 2).join(' | ') || '无相关日志')
  check('取回失败时只告警，不阻断发布', staleLogs.some((l) => l.startsWith('warn')), staleLogs.filter((l) => l.startsWith('warn')).slice(0, 1).join(' | '))
  check('取回失败时旧文件仍在（不会被删成空）', existsSync(stalePath) && readFileSync(stalePath).length > 12)
  check('其余美术未被牵连', [...seeded.keys()].filter((f) => f !== staleAsset.file)
    .every((f) => existsSync(join(dest, 'assets', f))))
} catch (error) {
  check('同步流程未抛异常', false, error?.stack ?? String(error))
} finally {
  delete process.env.DSH_SKINS_HOME
  if (keepTmp) console.log(`\n沙箱目录保留在：${tmpRoot}`)
  else rmSync(tmpRoot, { recursive: true, force: true })
}

// ------------------------------------------------------------------ 结论
console.log('\n== 结论 ==')
for (const n of notes) console.log(`  · ${n}`)
if (failures.length === 0) {
  console.log('\n全部通过：皮肤插件契约成立——皮肤随包同步，皮肤中心（渲染器 + 壁纸）是可选项。\n')
  process.exit(0)
}
console.log(`\n${failures.length} 项失败：`)
for (const f of failures) console.log(`  - ${f}`)
console.log('')
process.exit(1)

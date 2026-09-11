/**
 * dsh-jinhsi-skin — 把「今汐·洄天溯海」装进皮肤中心的用户皮肤目录。
 *
 * 为什么需要这个主机插件：
 *   皮肤中心只从两个地方发现皮肤 —— 它自己的内置目录，以及 `$DSH_HOME/skins/<id>/`。
 *   它没有对外暴露注册 API，而 `dsh plugin add` 装的是 profile 的 node_modules，
 *   两者不是同一个位置。所以这个插件的作用很单纯：把自己包里那份 `skin/`
 *   同步到 `$DSH_HOME/skins/jinhsi-spectro/`，让皮肤中心收得到。
 *
 * 路径解析与皮肤中心完全一致（见其 lib/index.js 的 userSkinsDir / resolveHarnessHome）：
 *   DSH_SKINS_HOME → DSH_SKINS_DIR → `${DSH_HOME:-~/.dsh}/skins`
 * 解析结果会打日志，路径不符时一眼能看出来。
 *
 * 官方美术（角色立绘与头像，版权归库洛游戏）不随包分发。本插件在首次安装后
 * 异步补齐它们：失败只告警，皮肤在缺少立绘时仍可加载。
 */

import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIN_SRC = join(PKG_ROOT, 'skin')
const SOURCES = join(PKG_ROOT, 'tools', 'asset-sources.json')
const SKIN_ID = 'jinhsi-spectro'
const MARKER = '.dsh-jinhsi-skin.json'
const TAG = '[jinhsi-skin]'

/** 与 dsh 启动器一致的 harness home 解析。 */
function harnessHome(env) {
  const h = env.DSH_HOME
  if (typeof h === 'string' && h.trim() !== '') return h
  return join(homedir(), '.dsh')
}

/** 与皮肤中心 userSkinsDir 一致。 */
export function userSkinsDir(env = process.env) {
  const a = env.DSH_SKINS_HOME
  if (typeof a === 'string' && a.trim() !== '') return resolve(a)
  const b = env.DSH_SKINS_DIR
  if (typeof b === 'string' && b.trim() !== '') return resolve(b)
  return join(harnessHome(env), 'skins')
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function isWebp(buf) {
  return buf.length >= 12
    && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WEBP'
}

/**
 * 同步皮肤目录。幂等：版本一致就跳过。
 * 先复制到同级临时目录再改名，避免中途失败留下半个皮肤。
 */
function syncSkin(log) {
  const manifest = readJson(join(SKIN_SRC, 'skin.json'))
  if (manifest === null) {
    log.warn(`包内缺少 skin/skin.json，跳过（包可能不完整）`)
    return null
  }

  const dest = join(userSkinsDir(), SKIN_ID)
  const markerPath = join(dest, MARKER)
  const marker = readJson(markerPath)
  if (marker !== null && marker.version === manifest.version) {
    log.info(`皮肤已是最新（v${manifest.version}）：${dest}`)
    return dest
  }

  const staging = `${dest}.staging`
  try {
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(SKIN_SRC, staging, { recursive: true })
    writeFileSync(join(staging, MARKER), JSON.stringify({
      id: SKIN_ID,
      version: manifest.version,
      installedBy: 'dsh-jinhsi-skin',
    }, null, 2) + '\n', 'utf8')

    rmSync(dest, { recursive: true, force: true })
    renameSync(staging, dest)
    log.info(`皮肤已安装：${dest}（v${manifest.version}）`)
    return dest
  } catch (error) {
    try {
      rmSync(staging, { recursive: true, force: true })
    } catch { /* 清理失败不掩盖原始错误 */ }
    log.error(`皮肤安装失败：${error.message}`)
    return null
  }
}

/**
 * 异步补齐官方美术。只在缺失时触发，失败不影响皮肤加载。
 * 来源与校验方式与 tools/fetch-assets.mjs 完全一致，共用同一份 asset-sources.json。
 */
async function fetchMissingAssets(skinDir, log) {
  const spec = readJson(SOURCES)
  if (spec === null) return

  const assetsDir = join(skinDir, 'assets')
  const missing = spec.assets.filter((a) => a.optional !== true
    && !existsSync(join(assetsDir, a.file)))
  if (missing.length === 0) return

  log.info(`官方美术缺失 ${missing.length} 项，开始从 ${spec.cdn} 获取（版权归库洛游戏，仅本机使用）`)
  mkdirSync(assetsDir, { recursive: true })

  for (const asset of missing) {
    let downloaded = null
    for (let attempt = 1; attempt <= 3 && downloaded === null; attempt += 1) {
      try {
        const res = await fetch(`${spec.cdn}${asset.path}`, { redirect: 'follow' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        if (!isWebp(buf)) throw new Error('返回的不是 WebP')
        downloaded = buf
      } catch (error) {
        if (attempt === 3) log.warn(`${asset.file} 获取失败：${error.message}`)
        else await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
    if (downloaded === null) continue
    try {
      writeFileSync(join(assetsDir, asset.file), downloaded)
      log.info(`${asset.file} 已就绪（${Math.round(downloaded.length / 1024)} KB）`)
    } catch (error) {
      log.warn(`${asset.file} 写入失败：${error.message}`)
    }
  }

  const still = spec.assets.filter((a) => a.optional !== true
    && !existsSync(join(assetsDir, a.file)))
  if (still.length === 0) log.info('官方美术已齐备，刷新页面即可看到立绘')
  else log.warn(`仍有 ${still.length} 项缺失，可手动放入 ${assetsDir}：${still.map((a) => a.file).join(', ')}`)
}

/** 记录本次 apply 的清理动作；dispose 时不做破坏性操作（保留已安装的皮肤）。 */
function makeLogger(ctx) {
  const sink = (level, message) => {
    const line = `${TAG} ${message}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.info(line)
  }
  return {
    info: (m) => sink('info', m),
    warn: (m) => sink('warn', m),
    error: (m) => sink('error', m),
  }
}

export const name = 'dsh-jinhsi-skin'

/**
 * 主机插件入口。不依赖任何服务（不需要 webServer），
 * 只做一次本地文件同步，然后按需异步补美术。
 */
export function apply(ctx) {
  const log = makeLogger(ctx)
  const dir = syncSkin(log)
  if (dir === null) return () => {}

  // 不 await：启动路径上不阻塞，下载完再打日志。
  // 卸下插件时同步不会被打断（它是本地纯读写），所以不需要注册清理。
  fetchMissingAssets(dir, log).catch((error) => {
    log.warn(`美术获取任务异常退出：${error?.message ?? error}`)
  })

  return () => {}
}

/**
 * dsh-jinhsi-skin — 今汐皮肤插件（host 半区）。
 *
 * 本文件只干一件事：把包内的 `skin/` 同步到用户皮肤目录
 * `$DSH_HOME/skins/jinhsi-spectro/`——皮肤中心（或别的渲染器）只从两个地方
 * 发现皮肤：它自己的内置目录，和这个用户目录。皮肤中心没有对外注册 API，
 * 而 `dsh plugin add` 装的是 profile 的 node_modules，两者不是同一个位置，
 * 所以需要这一半。对应 cordis.patch.yml 里的 `ui-skin-jinhsi-spectro` 一行。
 *
 * **渲染器（含壁纸）是可选依赖。** 皮肤本身是纯声明式资产目录，要有人渲染才会
 * 显示；本包把 `@linxin666/dsh-client-ui-skin-center` 声明为 optional peer
 * dependency，装不装由使用者决定——装上就有「设置 → 皮肤中心」的试穿/应用、
 * 背景遮蔽滑杆与壁纸（Wallpaper Engine 桥 + 手动媒体文件夹）。
 *
 * 路径解析与皮肤中心完全一致（见其 lib/index.js 的 userSkinsDir / resolveHarnessHome）：
 *   DSH_SKINS_HOME → DSH_SKINS_DIR → `${DSH_HOME:-~/.dsh}/skins`
 * 解析结果会打日志，路径不符时一眼能看出来。
 *
 * 官方美术（库洛官方的今汐插画与头像，版权归库洛游戏）不随包分发。本插件在同步时：
 *   · 先保住本机已有的美术（换版本、重装、离线时不会被抹掉）；
 *   · 再铺包内的声明式皮肤；
 *   · 最后才补齐仍缺失 / 与来源表 sha256 不符的美术（有界重试，失败只告警，
 *     少了插画皮肤照样能加载）。
 */

import {
  cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
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
    // 去掉 UTF-8 BOM：Node 的 'utf8' 解码会把 BOM 留成 \uFEFF，
    // JSON.parse 会直接抛错。而 Windows 上的 PowerShell Set-Content -Encoding UTF8
    // 默认带 BOM —— 手工维护过的标记文件就会踩到，表现为「明明版本一致却又重装一遍」。
    const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 官方美术的容器校验：WebP（RIFF/WEBP）、JPEG（FFD8FF）或 PNG（\x89PNG）。 */
function imageKind(buf) {
  if (buf.length >= 12
    && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WEBP') return 'WebP'
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'JPEG'
  if (buf.length >= 8
    && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'PNG'
  return null
}

/** 一项素材的下载地址：绝对 url 优先，否则 cdn + path。 */
function assetUrl(spec, asset) {
  if (typeof asset.url === 'string' && asset.url !== '') return asset.url
  return `${spec.cdn}${asset.path}`
}

/**
 * 把已安装目录里的官方美术搬进暂存区。
 *
 * 为什么必须有这一步：官方美术不随包分发（版权归库洛游戏，只在本机获取）。
 * 如果同步时直接用包内的 `skin/` 覆盖暂存区，那么每次升级、每次重装都会把
 * 用户本机已经下好的插画抹掉，然后重新联网下一遍——离线环境下就是「插画没了」。
 * 先搬旧的、再铺新的，最后才补缺，同步就变成幂等且离线安全的。
 */
function carryOverInstalledAssets(dest, staging) {
  const from = join(dest, 'assets')
  if (!existsSync(from)) return
  try {
    cpSync(from, join(staging, 'assets'), { recursive: true })
  } catch {
    // 搬不动就当作没有：后面 fetchMissingAssets 会重新补。
  }
}

/**
 * 本机已生成过的「真实预览」优先于仓库里的占位版。
 *
 * 仓库提交的 `skin/preview/*.jpg` 是**不含官方美术**的占位版（`.gitignore`
 * 那一段注释写明了原因）；本机若用 `tools/make-preview.mjs --out-dir <皮肤目录>/preview`
 * 生成过含官方美术的真实预览，这里要把它保住，否则每次同步都会被打回占位版。
 * 这一步必须放在 `cpSync(SKIN_SRC → staging)` **之后**（后写者赢）。
 */
function restoreLocalPreviews(dest, staging) {
  const from = join(dest, 'preview')
  if (!existsSync(from)) return
  try {
    cpSync(from, join(staging, 'preview'), { recursive: true })
  } catch {
    // 搬不动就留着包内的占位版：预览图只是观感，不影响皮肤加载。
  }
}

/**
 * 同步皮肤目录。幂等：版本一致就跳过。
 *
 * 关键顺序：**先把官方美术补齐，再发布皮肤目录**。
 * 早先的实现是「先 rename 发布、再异步下载美术」，于是有一个时间窗口：
 * 皮肤已进目录册，但 assets/*.webp 还没落地。用户若在这个窗口刷新页面，
 * 浏览器会拿到头像/立绘的 404 并缓存住——表现就是「主题在、头像和立绘不见了」，
 * 而且之后不硬刷新不会自愈。所以改成在 staging 目录里备齐美术，最后才改名发布。
 *
 * @param {{info:Function,warn:Function,error:Function}} log 日志器。
 * @returns {Promise<string|null>} 发布后的皮肤目录，失败时为 null。
 */
export async function syncSkin(log) {
  const manifest = readJson(join(SKIN_SRC, 'skin.json'))
  if (manifest === null) {
    log.warn('包内缺少 skin/skin.json，跳过（包可能不完整）')
    return null
  }

  const dest = join(userSkinsDir(), SKIN_ID)
  const marker = readJson(join(dest, MARKER))
  // 稳定态**不打字**：每次启动都往控制台写一行「已是最新」只会淹掉真正的日志。
  if (marker !== null && marker.version === manifest.version) return dest

  const staging = `${dest}.staging`
  try {
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(dirname(dest), { recursive: true })
    carryOverInstalledAssets(dest, staging)
    cpSync(SKIN_SRC, staging, { recursive: true })
    restoreLocalPreviews(dest, staging)
  } catch (error) {
    try { rmSync(staging, { recursive: true, force: true }) } catch { /* 不掩盖原始错误 */ }
    log.error(`暂存皮肤失败：${error.message}`)
    return null
  }

  // 美术就位（每个请求都有界，失败也继续发布——缺插画的皮肤仍能加载）
  await fetchMissingAssets(staging, log)

  try {
    writeFileSync(join(staging, MARKER), JSON.stringify({
      id: SKIN_ID,
      version: manifest.version,
      installedBy: 'dsh-jinhsi-skin',
    }, null, 2) + '\n', 'utf8')

    // 交换发布：**不能先 rmSync(dest) 再 rename**。
    // 那之间有一步「皮肤目录不存在」，皮肤中心的资源路由会在这段时间里 404，
    // 而浏览器会把 404 缓存住 —— 症状正是「主题还在，头像和立绘忽然没了」。
    // 改成两次 rename（都是元数据操作，间隙在微秒级）：
    //   dest → dest.old ; staging → dest ; 再删 dest.old
    const backup = `${dest}.old`
    rmSync(backup, { recursive: true, force: true })
    let hadOld = false
    if (existsSync(dest)) {
      renameSync(dest, backup)
      hadOld = true
    }
    try {
      renameSync(staging, dest)
    } catch (error) {
      // 回滚：把旧目录放回去，别让用户没有皮肤可用
      if (hadOld) {
        try { renameSync(backup, dest) } catch { /* 尽力而为 */ }
      }
      throw error
    }
    if (hadOld) rmSync(backup, { recursive: true, force: true })

    log.info(`皮肤已安装：${dest}（v${manifest.version}）`)
    return dest
  } catch (error) {
    try { rmSync(staging, { recursive: true, force: true }) } catch { /* 同上 */ }
    log.error(`皮肤发布失败：${error.message}`)
    return null
  }
}

/** 每个素材的重试次数与单次超时；每个请求都有界，不会让发布无限等下去。 */
const ASSET_ATTEMPTS = 3
const ASSET_TIMEOUT_MS = 20000

/**
 * 异步补齐官方美术。只在缺失时触发，失败不影响皮肤加载。
 * 来源与校验方式与 tools/fetch-assets.mjs 完全一致，共用同一份 asset-sources.json。
 */
async function fetchMissingAssets(skinDir, log) {
  const spec = readJson(SOURCES)
  if (spec === null) return

  const assetsDir = join(skinDir, 'assets')
  // 「缺」不只是不存在：来源表里写了 sha256 的话，内容对不上也算缺——
  // 否则换背景、换立绘时，上一版留在本机的旧图会一直冒充新图（同步是幂等的，
  // 只会补缺，不会覆盖已有的同名文件）。写盘仍走「下载成功才覆盖」，
  // 所以离线重同步时旧图会原样留着，不会把背景搞丢。
  const isStale = (asset) => {
    const path = join(assetsDir, asset.file)
    if (!existsSync(path)) return true
    if (typeof asset.sha256 !== 'string' || asset.sha256 === '') return false
    try {
      return createHash('sha256').update(readFileSync(path)).digest('hex') !== asset.sha256
    } catch {
      return false
    }
  }
  const missing = spec.assets.filter((a) => a.optional !== true && isStale(a))
  if (missing.length === 0) return

  log.info(`官方美术缺失 ${missing.length} 项，开始获取（来源见 tools/asset-sources.json；版权归库洛游戏，仅本机使用）`)
  mkdirSync(assetsDir, { recursive: true })

  for (const asset of missing) {
    let downloaded = null
    for (let attempt = 1; attempt <= ASSET_ATTEMPTS && downloaded === null; attempt += 1) {
      try {
        const res = await fetch(assetUrl(spec, asset), {
          redirect: 'follow',
          signal: AbortSignal.timeout(ASSET_TIMEOUT_MS),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        if (imageKind(buf) === null) throw new Error('返回的不是图片')
        downloaded = buf
      } catch (error) {
        if (attempt === ASSET_ATTEMPTS) log.warn(`${asset.file} 获取失败：${error.message}`)
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

  const still = spec.assets.filter((a) => a.optional !== true && isStale(a))
  if (still.length === 0) log.info('官方美术已齐备')
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
 * 主机插件入口。不依赖任何服务（不需要 webServer）——
 * 皮肤中心那一半由 cordis.patch.yml 的另一行负责。
 *
 * **不同步等待**：启动路径上不能阻塞。同步 + 补美术在后台完成，
 * 且**美术就位后才把皮肤目录改名发布**——避免「皮肤已可见、图还没到」
 * 的窗口让浏览器缓存下 404。
 */
export function apply(ctx) {
  const log = makeLogger(ctx)

  syncSkin(log).catch((error) => {
    log.warn(`皮肤同步任务异常退出：${error?.message ?? error}`)
  })

  return () => {}
}

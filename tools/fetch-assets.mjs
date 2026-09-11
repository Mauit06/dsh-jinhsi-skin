#!/usr/bin/env node
/**
 * fetch-assets.mjs — 从 wuther.in 的静态资源 CDN 获取今汐的官方美术到 skin/assets/。
 *
 * 为什么是「安装时获取」而不是「随仓库分发」：
 *   这些立绘与头像的版权归库洛游戏所有。把它们打包进公开仓库属于再分发受版权保护的
 *   素材，既可能招致 DMCA，也不符合 GitHub 对侵权内容的规定。所以本仓库只保存**来源
 *   与完整性锚点**（tools/asset-sources.json），真正的字节由你在本机获取。
 *   皮肤的自绘纹样（crest / scales / tide / seal / feather）不受影响，它们随仓库分发。
 *
 * 校验策略（fail-closed 但不脆）：
 *   · 必须能下载到、且必须是合法 WebP（RIFF….WEBP 魔数）——否则算失败；
 *   · sha256 与 asset-sources.json 记录不一致时**只告警不阻断**，
 *     因为上游站点更新素材是正常情况，记录值只是「来源未变」的锚点。
 *
 * 用法：
 *   node tools/fetch-assets.mjs            # 缺什么补什么，已有的跳过
 *   node tools/fetch-assets.mjs --force    # 全部重新下载
 *   node tools/fetch-assets.mjs --check    # 只检查，不下载（离线可用）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ASSETS = join(ROOT, 'skin', 'assets')
const SOURCES = join(ROOT, 'tools', 'asset-sources.json')

const FORCE = process.argv.includes('--force')
const CHECK_ONLY = process.argv.includes('--check')

const ok = (m) => process.stdout.write(`  ✓ ${m}\n`)
const info = (m) => process.stdout.write(`  · ${m}\n`)
const warn = (m) => process.stdout.write(`  ⚠ ${m}\n`)
const bad = (m) => process.stdout.write(`  ✗ ${m}\n`)

/** WebP 魔数：RIFF????WEBP。 */
function isWebp(buf) {
  return buf.length >= 12
    && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WEBP'
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 带重试的下载。CDN 偶发 ECONNRESET / fetch failed 很常见，
 * 一次失败就判死刑会让「安装时获取」这条路径不可靠。
 */
async function download(url, attempts = 3) {
  let lastError = null
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!isWebp(buf)) throw new Error('返回的不是 WebP（魔数不符）')
      return buf
    } catch (err) {
      lastError = err
      if (i < attempts) await sleep(400 * i)
    }
  }
  throw lastError
}

async function main() {
  if (!existsSync(SOURCES)) {
    bad(`缺少来源清单：${SOURCES}`)
    process.exitCode = 1
    return
  }
  const spec = JSON.parse(readFileSync(SOURCES, 'utf8'))
  mkdirSync(ASSETS, { recursive: true })

  const required = spec.assets.filter((a) => a.optional !== true)
  const optional = spec.assets.filter((a) => a.optional === true)

  process.stdout.write(`\n今汐官方美术 · ${CHECK_ONLY ? '仅检查' : FORCE ? '强制重下' : '补齐缺失'}\n`)
  info(`来源：${spec.cdn}（站点页面 ${spec.page}）`)
  info(spec.license)
  process.stdout.write('\n')

  let missing = 0
  let fetched = 0
  let mismatched = 0
  const failures = []

  for (const asset of spec.assets) {
    const dest = join(ASSETS, asset.file)
    const tag = asset.optional ? '(可选)' : '(必需)'

    // 已存在：校验
    if (existsSync(dest) && !FORCE) {
      const buf = readFileSync(dest)
      if (!isWebp(buf)) {
        warn(`${asset.file} ${tag} 已存在但不是合法 WebP —— 建议 --force 重下`)
        failures.push(asset.file)
        continue
      }
      const digest = sha256(buf)
      if (digest !== asset.sha256) {
        warn(`${asset.file} ${tag} 已存在，但 sha256 与清单不一致（上游可能已更新）`)
        mismatched += 1
      } else {
        ok(`${asset.file} ${tag} 已就绪 ${(buf.length / 1024).toFixed(0)} KB`)
      }
      continue
    }

    if (CHECK_ONLY) {
      const state = existsSync(dest) ? '存在但需要 --force' : '缺失'
      ;(asset.optional ? warn : bad)(`${asset.file} ${tag} ${state}`)
      if (!asset.optional) { missing += 1; failures.push(asset.file) }
      continue
    }

    const url = `${spec.cdn}${asset.path}`
    try {
      const buf = await download(url)

      const digest = sha256(buf)
      writeFileSync(dest, buf)
      fetched += 1
      if (digest !== asset.sha256) {
        warn(`${asset.file} ${tag} 已下载，但 sha256 与清单不一致（上游可能已更新）`)
        mismatched += 1
      } else {
        ok(`${asset.file} ${tag} ${(buf.length / 1024).toFixed(0)} KB  sha256 校验通过`)
      }
    } catch (err) {
      if (asset.optional) {
        warn(`${asset.file} ${tag} 获取失败：${err.message}（可选，跳过）`)
      } else {
        bad(`${asset.file} ${tag} 获取失败：${err.message}`)
        failures.push(asset.file)
      }
    }
  }

  // 汇总
  process.stdout.write('\n')
  const present = readdirSync(ASSETS).filter((f) => f.endsWith('.webp'))
  const requiredPresent = required.filter((a) => existsSync(join(ASSETS, a.file)))

  if (requiredPresent.length === required.length) {
    ok(`必需素材齐备（${requiredPresent.length}/${required.length}）`)
  } else {
    bad(`必需素材缺失（${requiredPresent.length}/${required.length}）：${required.filter((a) => !existsSync(join(ASSETS, a.file))).map((a) => a.file).join(', ')}`)
  }
  info(`skin/assets/ 下现有 ${present.length} 个 WebP`)

  if (CHECK_ONLY) {
    info(present.length === 0
      ? '当前没有任何官方素材 —— 这是仓库的初始状态，运行不带 --check 即可获取。'
      : '')
  } else if (fetched > 0) {
    ok(`新获取 ${fetched} 个文件`)
  }
  if (mismatched > 0) info(`${mismatched} 个文件的 sha256 与清单不同（仅提示，不影响使用）`)

  if (failures.length > 0) {
    process.stdout.write('\n')
    bad(`有 ${failures.length} 项必需素材不可用：${failures.join(', ')}`)
    process.stdout.write('  可能原因：网络不可达、上游站点改版、或该素材路径已变更。\n')
    process.stdout.write('  皮肤在缺少背景立绘时仍可加载（仅少一张立绘）；\n')
    process.stdout.write('  但缺少 jinhsi-head.webp 会让品牌与头像位置显示为空。\n')
    process.stdout.write(`  也可以手动把图片放到 skin/assets/ 下对应的文件名：\n`)
    for (const f of failures) process.stdout.write(`    - ${f}\n`)
    process.exitCode = 1
    return
  }

  process.stdout.write('\n')
  ok('全部就绪。')
}

main().catch((err) => {
  bad(`未预期的错误：${err.message}`)
  process.exitCode = 1
})

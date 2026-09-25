#!/usr/bin/env node
/**
 * make-preview.mjs — 生成 skin/preview/light.jpg 与 dark.jpg。
 *
 * 做法：用 headless Edge/Chrome 打开 tools/preview-mock.html（静态壳层复刻，
 * 引真实 skin.css / patches.css），经 Chrome DevTools Protocol 直接以 JPEG
 * 抓图。因为走的是真实浏览器排版与合成，这一步同时充当皮肤的离线渲染自检：
 * 能出图即证明两份样式表被浏览器接受并生效。
 *
 * 首选 CDP（可真出 JPEG）；CDP 不可用时退化为 Edge 的 --screenshot（只能出 PNG），
 * 并打印提示，此时需要把 skin.json 的 preview 扩展名改成 .png。
 *
 * 用法：node tools/make-preview.mjs [--width 1280] [--height 800] [--quality 90]
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MOCK = join(ROOT, 'tools', 'preview-mock.html')
/**
 * 预览图输出目录。默认写进仓库的 skin/preview/。
 *
 * install.ps1 会传 --out-dir 指向**安装副本**，于是含官方美术的真实预览只出现在
 * .dsh/skins/ 下，而仓库里的 skin/preview/ 永远停留在不含版权素材的占位版——
 * 后续 git push 也就不会把美术提交上去。
 */
const OUT_DIR = (() => {
  const i = process.argv.indexOf('--out-dir')
  return i !== -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : join(ROOT, 'skin', 'preview')
})()

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const WIDTH = Number(arg('width', 1280))
const HEIGHT = Number(arg('height', 800))
const QUALITY = Number(arg('quality', 90))
/** 皮肤中心「背景遮蔽」滑杆值；用户当前设置为 50 → 0.5。 */
const WE_SCRIM = Number(arg('we-scrim', 0.5))

const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findBrowser() {
  for (const p of BROWSER_CANDIDATES) if (existsSync(p)) return p
  return null
}

/** 极简 CDP 客户端：连一个 target 的 WebSocket，按 id 配对响应。 */
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('当前 Node 没有内置 WebSocket（需要 Node 22+）'))
      return
    }
    const ws = new WebSocket(wsUrl)
    const pending = new Map()
    let nextId = 1
    const client = {
      /** 由调用方覆盖，用于接收 CDP 事件。 */
      onEvent: null,
      send(method, params = {}) {
        const id = nextId++
        return new Promise((res, rej) => {
          pending.set(id, { res, rej, method })
          ws.send(JSON.stringify({ id, method, params }))
          setTimeout(() => {
            if (pending.delete(id)) rej(new Error(`CDP 超时：${method}`))
          }, 30000)
        })
      },
      close() { try { ws.close() } catch { /* 忽略 */ } },
    }

    ws.addEventListener('open', () => resolve(client))

    ws.addEventListener('message', (event) => {
      let msg
      try { msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)) } catch { return }
      if (msg.id === undefined) {
        if (client.onEvent) client.onEvent(msg)
        return
      }
      const entry = pending.get(msg.id)
      if (!entry) return
      pending.delete(msg.id)
      if (msg.error) entry.rej(new Error(`${entry.method}: ${msg.error.message}`))
      else entry.res(msg.result)
    })

    ws.addEventListener('error', () => reject(new Error(`无法连接 CDP：${wsUrl}`)))
    setTimeout(() => reject(new Error('CDP 连接超时')), 15000)
  })
}

async function waitForDevtools(port, deadlineMs = 25000) {
  const started = Date.now()
  while (Date.now() - started < deadlineMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return true
    } catch { /* 还没起来 */ }
    await sleep(250)
  }
  return false
}

/** 打开一个空 target，返回其 webSocketDebuggerUrl。 */
async function openTarget(port) {
  // 新版 Chromium 要求 PUT /json/new。这里只开 about:blank，
  // 真正的跳转交给 Page.navigate —— 避免把带 query 的 file:// URL
  // 塞进 /json/new 的查询串时被百分号编码吞掉 ?theme=… 。
  for (const init of [{ method: 'PUT' }, { method: 'GET' }]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, init)
      if (!res.ok) continue
      const json = await res.json()
      if (json.webSocketDebuggerUrl) return json
    } catch { /* 试下一种 */ }
  }
  throw new Error('无法创建 CDP target')
}

/** 深色变体：切 body 属性并换用深色插画与遮罩。
 *  这两个值必须与 skin.json 的 backgroundMedia.dark 保持一致。 */
const DARK_EXPRESSION = `(() => {
  document.body.setAttribute('data-ds-dark-theme', '');
  const img = document.querySelector('[data-dsh-skin-layer="background"] > img');
  const scrim = document.querySelector('[data-dsh-skin-layer="background"] > div');
  if (img) img.src = '../skin/assets/jinhsi-art-dark.png';
  if (scrim) scrim.style.background = 'linear-gradient(90deg, rgba(10,13,17,0.96) 0%, rgba(10,13,17,0.88) 30%, rgba(12,18,24,0.56) 56%, rgba(12,18,24,0.14) 80%, rgba(12,18,24,0) 100%)';
  return document.body.hasAttribute('data-ds-dark-theme');
})()`

/**
 * Wallpaper Engine 模式：复刻 WallpaperController 挂载壁纸后的 DOM 状态。
 *   1. html 与 body 同时带上 data-dsh-wallpaper-active（backdrop-scene.ts 的行为）
 *   2. 皮肤背景媒体被抑制 —— 控制器走 clearLayer(layers.background)，只清子节点
 *   3. WE 媒体层在 z-index:-3
 * 皮肤该做的事全在 patches.css 里，这里只是把环境摆出来。
 */
const weExpression = (wallpaperUrl, scrim) => `(() => {
  document.documentElement.setAttribute('data-dsh-wallpaper-active', 'true');
  document.body.setAttribute('data-dsh-wallpaper-active', 'true');
  /* 皮肤中心的「背景遮蔽」滑杆值下发在 body 的 --dsw-skin-scrim 上。
     这里对齐用户当前的实际设置，预览才是他会看到的样子。 */
  document.body.style.setProperty('--dsw-skin-scrim', ${JSON.stringify(String(scrim))});

  const bg = document.querySelector('[data-dsh-skin-layer="background"]');
  if (bg) bg.replaceChildren();

  if (!document.getElementById('mock-we-media')) {
    const media = document.createElement('div');
    media.id = 'mock-we-media';
    media.setAttribute('data-dsh-wallpaper-layer', '');
    media.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:-3;pointer-events:none;';
    const img = document.createElement('img');
    img.src = ${JSON.stringify(wallpaperUrl)};
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    media.appendChild(img);
    document.body.appendChild(media);
  }
  return document.body.hasAttribute('data-dsh-wallpaper-active');
})()`

/** 空对话（新对话页）模式：只显示 hero，隐藏会话内容与会话头。 */
const HERO_EXPRESSION = `(() => {
  document.body.setAttribute('data-mock-hero', '');
  return document.body.hasAttribute('data-mock-hero');
})()`

/**
 * 占位模式（随仓库发布的预览图用）：
 * 仓库不分发官方美术，所以预览图里也不能有它。把立绘与头像换成自绘的令尹印，
 * 保留全部界面结构、配色与装饰 —— 主题长什么样依然看得出来，但不含版权素材。
 * 装到本机后 install.ps1 会在获取素材后重新生成真实预览。
 */
const PLACEHOLDER_EXPRESSION = `(() => {
  const bg = document.querySelector('[data-dsh-skin-layer="background"]');
  if (bg) bg.replaceChildren();

  const style = document.createElement('style');
  style.textContent = [
    '[data-slot="sidebar.brand.mark"] > svg,',
    '[data-slot="conversation.hero.brand.mark"] > svg,',
    '[data-chat-flow-kind="assistant-step"]:not([hidden])::before {',
    '  background-image: url(../skin/assets/crest.svg) !important;',
    '  background-size: 76% !important;',
    '  background-position: 50% 50% !important;',
    '  background-color: color-mix(in srgb, var(--jinhsi-gold) 14%, transparent) !important;',
    '}',
  ].join('\\\\n');
  document.head.appendChild(style);
  return true;
})()`

/** 用 CDP 渲染并抓一张 JPEG。 */
async function captureJpeg(port, url, outPath, { dark = false, weUrl = null, hero = false, placeholder = false } = {}) {
  const target = await openTarget(port)
  const cdp = await connectCdp(target.webSocketDebuggerUrl)
  try {
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
    })
    const loaded = new Promise((resolve) => {
      const timer = setTimeout(resolve, 8000)
      cdp.onEvent = (msg) => {
        if (msg.method === 'Page.loadEventFired') { clearTimeout(timer); resolve() }
      }
    })
    await cdp.send('Page.navigate', { url })
    await loaded
    await sleep(900)

    if (placeholder) {
      const res = await cdp.send('Runtime.evaluate', { expression: PLACEHOLDER_EXPRESSION, returnByValue: true })
      if (res?.result?.value !== true) throw new Error('占位模式未能应用')
      await sleep(500)
    }

    if (hero) {
      const res = await cdp.send('Runtime.evaluate', { expression: HERO_EXPRESSION, returnByValue: true })
      if (res?.result?.value !== true) throw new Error('hero 模式未能应用')
      await sleep(500)
    } else if (weUrl !== null) {
      const res = await cdp.send('Runtime.evaluate', { expression: weExpression(weUrl, WE_SCRIM), returnByValue: true })
      if (res?.result?.value !== true) throw new Error('WE 模式未能应用')
      await sleep(1100) // 等壁纸图片解码
    } else if (dark) {
      // 不依赖 URL query：直接改 DOM，结果可判定。
      const res = await cdp.send('Runtime.evaluate', { expression: DARK_EXPRESSION, returnByValue: true })
      const applied = res?.result?.value
      if (applied !== true) throw new Error('深色变体未能应用')
      await sleep(900)
    }

    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
    await sleep(400)

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: QUALITY, captureBeyondViewport: false, fromSurface: true,
    })
    const buf = Buffer.from(shot.data, 'base64')
    writeFileSync(outPath, buf)
    return { bytes: buf.length, format: 'jpeg' }
  } finally {
    cdp.close()
    try { await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`) } catch { /* 忽略 */ }
  }
}

/** 退化路径：Edge --screenshot，只能出 PNG。 */
function capturePngFallback(browser, url, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--virtual-time-budget=5000',
      `--screenshot=${outPath}`,
      url,
    ], { stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (existsSync(outPath) && statSync(outPath).size > 0) resolve({ bytes: statSync(outPath).size, format: 'png' })
      else reject(new Error(`--screenshot 失败，退出码 ${code}`))
    })
  })
}

async function main() {
  const browser = findBrowser()
  if (!browser) {
    console.error('找不到 Edge 或 Chrome，无法生成预览图。')
    process.exitCode = 1
    return
  }
  console.log(`浏览器：${browser}`)
  if (!existsSync(MOCK)) {
    console.error(`缺少 mock：${MOCK}`)
    process.exitCode = 1
    return
  }

  const mockUrl = pathToFileURL(MOCK).href
  const PLACEHOLDER = process.argv.includes('--placeholder')
  if (PLACEHOLDER) {
    console.log('占位模式：立绘与头像将替换为自绘令尹印，产出不含官方美术的预览图。')
  }
  const jobs = [
    { theme: 'light', url: mockUrl, out: join(OUT_DIR, 'light.jpg'), dark: false, weUrl: null, hero: false, placeholder: PLACEHOLDER },
    { theme: 'dark', url: mockUrl, out: join(OUT_DIR, 'dark.jpg'), dark: true, weUrl: null, hero: false, placeholder: PLACEHOLDER },
  ]

  // 新对话页（空对话）抬头验证
  if (process.argv.includes('--hero')) {
    jobs.push({
      theme: 'hero', url: mockUrl, out: join(ROOT, 'hero.jpg'),
      dark: false, weUrl: null, hero: true, placeholder: PLACEHOLDER,
    })
  }

  // 可选的第三张：Wallpaper Engine 适配验证。--we <壁纸图片路径>
  const weImage = arg('we', null)
  if (weImage !== null) {
    const abs = resolve(weImage)
    if (!existsSync(abs)) {
      console.error(`--we 指定的壁纸不存在：${abs}`)
      process.exitCode = 1
      return
    }
    jobs.push({
      theme: 'we', url: mockUrl, out: join(ROOT, 'we-adaptation.jpg'),
      dark: false, weUrl: pathToFileURL(abs).href,
    })
    console.log(`壁纸底图：${abs}`)
  }

  // ── 首选：CDP ──
  const port = 9200 + Math.floor(Math.random() * 300)
  const profile = mkdtempSync(join(tmpdir(), 'jinhsi-preview-'))
  let child = null
  let cdpOk = false

  try {
    child = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ], { stdio: 'ignore' })

    if (await waitForDevtools(port)) {
      cdpOk = true
      for (const job of jobs) {
        const res = await captureJpeg(port, job.url, job.out, { dark: job.dark, weUrl: job.weUrl, hero: job.hero, placeholder: job.placeholder })
        console.log(`  ✓ ${job.theme}  ${(res.bytes / 1024).toFixed(0)} KB  ${job.out.replace(ROOT, '.')}`)
      }
    } else {
      console.log('  · CDP 未就绪，改用 --screenshot 退化路径')
    }
  } catch (err) {
    console.log(`  · CDP 路径失败（${err.message}），改用 --screenshot 退化路径`)
    cdpOk = false
  } finally {
    if (child) { try { child.kill() } catch { /* 忽略 */ } }
    await sleep(400)
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* 忽略 */ }
  }

  // ── 退化：--screenshot（PNG） ──
  if (!cdpOk) {
    const results = []
    for (const job of jobs) {
      const pngOut = job.out.replace(/\.jpg$/, '.png')
      const res = await capturePngFallback(browser, job.url, pngOut)
      results.push({ theme: job.theme, path: pngOut, ...res })
      console.log(`  ✓ ${job.theme}  ${(res.bytes / 1024).toFixed(0)} KB  ${pngOut.replace(ROOT, '.')}  [PNG]`)
    }
    console.log('')
    console.log('注意：退化路径产出的是 PNG。请把 skin/skin.json 的 preview 改成：')
    for (const r of results) console.log(`  "${r.theme}": "preview/${r.path.split(/[\\/]/).pop()}"`)
  }

  console.log('')
  console.log(`尺寸 ${WIDTH}×${HEIGHT}，输出目录 skin/preview/`)
}

main().catch((err) => {
  console.error(`生成预览失败：${err.message}`)
  process.exitCode = 1
})

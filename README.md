# Jinhsi · Tidal Resurgence

**English** | [简体中文](README.zh-CN.md)

A **Jinhsi (今汐)** theme for the **DeepSeek Harness** web GUI — silver-white, ink black,
gold filigree and mint teal, with tidal meanders and dragon scales along the frame, a
Jinhsi avatar on the sidebar brand and every assistant message, and a conversation styled
after the game's Feixun (飞讯) messenger. The backdrop is **official Kuro artwork of Jinhsi**
(light: the official wallpaper 《雲青青兮欲雨，水澹澹兮生煙》; dark: the 「寒盡覺春生」 convene key visual).

This is a **skin plugin**: installing it places the skin into
`$DSH_HOME/skins/jinhsi-spectro/`.

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="Light theme">
  <img src="skin/preview/dark.jpg" width="49%" alt="Dark theme">
</p>

## Install

```powershell
dsh plugin --profile web add github:Mauit06/dsh-jinhsi-skin
```

Restart DSH once (adding a plugin package needs it).

### Optional: the Skin Center (renderer + wallpaper)

A skin is a purely declarative asset directory — it needs a **renderer** to show up. This
plugin declares the Skin Center `@linxin666/dsh-client-ui-skin-center` as an **optional peer
dependency**: whether to install it is your call.

```powershell
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center
```

- **With it**: you get *Settings → Skin Center*, where you can try on / apply the skin, drag
  the background-occlusion slider, and **use wallpaper** — the Wallpaper Engine bridge
  (video, web and scene wallpapers, or pin one static frame) or point the manual-folder row
  at any `.mp4` / `.webm`, a single wallpaper project, or a folder of projects.
- **Without it**: the skin is still synced into your skin directory and waits for a
  renderer. If your profile already has a Skin Center from somewhere else, you don't need a
  second one.

> A profile should hold exactly one Skin Center instance. If one is already mounted
> elsewhere (for example `web-ui-skin-center` from `@linxin666/dsh-web-all`), disable one of
> them: two live instances register duplicate `/api/skin-center/*` routes and mount the skin
> controller twice.

To remove: `dsh plugin --profile web remove dsh-jinhsi-skin`

Requires DSH ≥ `0.1.5-rc.1` and Node.js 22+.

## Wallpaper and background

Everything lives in the Skin Center card:

- **Background occlusion (0–100%)** — every translucent base in this skin is multiplied by
  `var(--dsw-skin-scrim)`, so the slider is a real knob: at 0 the artwork is clearest and the
  text sits on "paper" cards; at 100 it is nearly solid.
- **Background blur / input-card blur / bubble opacity** — for the empty conversation, the
  filled one, the composer card and message bubbles respectively.
- **Wallpaper panel** — use the local Wallpaper Engine library (Steam app 431960) as the GUI
  backdrop.

The skin **yields** to a wallpaper: once one is mounted
(`body[data-dsh-wallpaper-active]`) the background layer turns from a base into a scrim, the
ambient layer drops its diffraction glow, the foreground layer deepens its vignette, and
message rows get a paper card — while the gold filigree, dragon scales, corner meanders and
the magistrate seal stay. Under a wallpaper, those are the proof the skin is still there.

## Self-check

```powershell
node tools/verify-standalone.mjs
```

Offline verification of this plugin's contract: the patch mounts only the skin sync and
**never references the optional dependency** (an entry that cannot resolve is fail-loud at
startup); the Skin Center really is declared as an optional peer; every file `skin.json`
references exists; and the sync is idempotent, never wipes artwork already fetched on this
machine, and re-fetches when a sha256 no longer matches (a failed fetch only warns and never
empties an existing file). Runs in a temporary `DSH_SKINS_HOME`, no network.

## Official artwork is not redistributed

The character and illustrations are © **Kuro Games**. This repository ships none of them:
`skin/assets/*.webp` and `*.jpg` are git-ignored, and the plugin fetches them on **your**
machine from Kuro's official site / asset CDN at install time (sources, roles and sha256
anchors in [`tools/asset-sources.json`](tools/asset-sources.json)). The two previews above
are **placeholders** (`tools/make-preview.mjs --placeholder`): the layout and palette are
real, but the character and avatar slots use this project's own seal SVG instead of official
art. On your own machine you can generate real previews with
`node tools/make-preview.mjs --out-dir <skin dir>/preview`. Full rights breakdown:
[NOTICE](NOTICE).

## What you get

- Light and dark themes; the palette is sampled from the artwork, and the backdrop is
  official Kuro artwork of Jinhsi
- Six fixed decoration layers, filled with **CSS only** — no client JavaScript of its own
- Sidebar brand and every assistant message carry a Jinhsi avatar; the new-session headline
  becomes 「桃夭灼灼牵丝动 漂泊者」
- Feixun-style conversation: assistant "letter" cards, jade user bubbles with a tail
- State projection is pure CSS too (`:has()` reading attributes the official shell already
  sets): a gold sweep while streaming, mint pulse on tool calls, vermilion on turn errors
- Wallpaper (Wallpaper Engine or manual media) comes with the optional Skin Center

## Notes

- Built on the Skin Center's **v2 skin contract**; anchored on official `data-slot` outlets
  and the `data-dsh-surface` / `data-dsh-part` semantic attributes, never on CSS-Modules
  hash class names.
- Contract compliance and the one disclosed deviation are in
  [docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md) *(Chinese)*.

## Credits

- **Kuro Games** — *Wuthering Waves* and Jinhsi, plus the official illustrations and avatar
  used here (taken from the official wallpaper shares and character files on the
  [official website](https://wutheringwaves.kurogames.com/zh-tw/main/news), fetched locally
  and never redistributed).
- **[@linxin666/dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web)**
  (by zhu1090093659 / linxin666, Apache-2.0) — the Skin Center: the v2 skin contract, the six
  decoration layers, semantic-attribute stamping, the occlusion and blur sliders, and the
  Wallpaper Engine bridge and wallpaper panel. Without it, neither declarative third-party
  skins nor wallpaper would be possible.
- **DeepSeek Harness** — the host this theme targets.
- **wuther.in** — corpus source, and the source site for the avatar.
- **dsh-deep-whale / maid-atelier** (by Small-tailqwq) — reference for the skin directory
  layout and for packaging as a dsh bundle.
- **[Mornye Observation Skin](https://github.com/is-limo/Mornye-Observation-Skin)**
  (by is-limo) — the "layered observation workbench" idea; that repository is UNLICENSED, no
  code or assets were copied, and the state projection was reimplemented in pure CSS with
  `:has()`.
- **Blue Fantasy (blue-fantasy)** — the Skin Center's built-in skin, reference for the
  `--dsw-skin-scrim` coupling and decoration-layer usage.
- **Wallpaper Engine** and its Workshop content belong to their authors and the original
  wallpaper artists; this theme ships no wallpaper files, only a CSS adaptation that yields
  the backdrop and keeps text readable.

Unofficial fan project; not affiliated with or endorsed by any of the above.

[MIT](LICENSE) for the code, stylesheets, scripts, documentation and original vector
ornaments; official artwork is not covered by it.

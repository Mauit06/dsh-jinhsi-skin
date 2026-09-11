# Jinhsi · Tidal Resurgence

**English** | [简体中文](README.zh-CN.md)

A **Jinhsi (今汐)** theme for the **DeepSeek Harness** web GUI — silver-white, ink black,
gold filigree and mint teal, with tidal meanders and dragon scales along the frame, a
Jinhsi avatar in the sidebar, and a conversation styled after the game's Feixun (飞讯)
messenger.

Pure declarative skin: no executable code, no telemetry, no network calls at runtime.

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="Light theme">
  <img src="skin/preview/dark.jpg" width="49%" alt="Dark theme">
</p>

## ⚠️ Official artwork is not included

The character art is © **Kuro Games**. This repository ships none of it:
`skin/assets/*.webp` is git-ignored, and [`tools/fetch-assets.mjs`](tools/fetch-assets.mjs)
downloads it on your machine at install time. The previews above are placeholders using
this project's own seal SVG. Full rights breakdown: [NOTICE](NOTICE).

## Install

```powershell
# Skin only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# Skin + the optional Jinhsi agent persona
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -WithPersona
```

Then **refresh the page** → **Settings → Skin Center** → 「今汐·洄天溯海」 → *Try on* → *Apply*.
No `dsh` restart needed. Remove with `uninstall.ps1`.

Requires DSH ≥ `0.1.5-rc.1` with the Skin Center, and Node.js 22+ (to fetch the artwork).

## What you get

- Light and dark themes; palette sampled from the artwork rather than guessed
- Six fixed decoration layers filled with **CSS only** — no JavaScript
- Sidebar brand and every assistant message carry a Jinhsi avatar; the new-session
  headline becomes 「桃夭灼灼牵丝动 漂泊者」
- Feixun-style conversation: assistant "letter" cards, jade user bubbles with a tail
- Wallpaper Engine aware — the skin yields the backdrop to your wallpaper and keeps text
  readable; one knob (the background occlusion slider) tunes it
- Optional Jinhsi agent persona — swaps only the `persona` row of `standard`, so the agent
  keeps all its tools
- `corpus/` — all Jinhsi text: 5 stories, 75 voice lines, 17 skills, 6 chains, 2 outfits

## Notes

- Built on the Skin Center's **v2 skin contract**; anchored on official `data-slot` outlets,
  never on CSS-Modules hash class names.
- `node tools\validate-skin.mjs` checks schema, CSS whitelist, selector scoping, token
  names and contrast. Contract compliance and the one disclosed deviation are documented in
  [docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md) *(Chinese)*.
- Install options, troubleshooting, manual install: [INSTALL.md](INSTALL.md) *(Chinese)*.

## Attribution

Kuro Games (*Wuthering Waves*, Jinhsi) ·
[dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web) (the v2 contract this
is built on) · DeepSeek Harness · wuther.in (corpus source) · blue-fantasy and maid-atelier
(layout and slider references) · [Mornye Observation Skin](https://github.com/is-limo/Mornye-Observation-Skin)
(design idea only — that repository is UNLICENSED, no code or assets were copied).

Unofficial fan project; not affiliated with or endorsed by any of the above.

[MIT](LICENSE) for the code, stylesheets, scripts, documentation and original vector
ornaments.

# Jinhsi · Tidal Resurgence — a DeepSeek Harness skin

**English** | [简体中文](README.zh-CN.md)

A fan-made theme for the **DeepSeek Harness** web GUI, built around **Jinhsi (今汐)**,
Magistrate of Jinzhou from *Wuthering Waves*.

Silver-white, ink black, gold filigree, pale ice blue and mint teal — sampled from the
character's actual artwork rather than guessed. Tidal meanders and dragon scales run
along the fixed decoration layers, the sidebar brand becomes Jinhsi herself, and the
conversation is restyled after the game's **Feixun (飞讯)** messenger.

Pure declarative skin: no executable code, no telemetry, no network calls at runtime.

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="Light theme">
  <img src="skin/preview/dark.jpg" width="49%" alt="Dark theme">
</p>

---

## ⚠️ Read this first: about the artwork

**This repository does not contain any official Kuro Games artwork.**

The character portraits and avatar are copyrighted by **Kuro Games**. Bundling them into a
public repository would mean redistributing protected assets, so instead:

- `skin/assets/*.webp` is **git-ignored**.
- [`tools/fetch-assets.mjs`](tools/fetch-assets.mjs) downloads them **on your machine** at
  install time, from wuther.in's static asset CDN. Sources and sha256 anchors live in
  [`tools/asset-sources.json`](tools/asset-sources.json).
- The preview images committed here are generated in `--placeholder` mode: the portrait and
  avatar slots are filled with this project's **own** *Magistrate's Seal* SVG, so the
  theme's structure, palette and ornament stay visible without shipping anyone's art.
  `install.ps1` regenerates the real previews locally once the assets are in place.

Everything this project actually authored — code, stylesheets, vector ornaments, palette,
documentation — is MIT licensed. See [NOTICE](NOTICE) for the full rights breakdown.

---

## Features

### Visual

- **Palette sampled from the artwork**, not invented: porcelain white, ink black, antique
  gold, pale ice blue, mint teal. Full light and dark themes.
- **Six fixed decoration layers, filled with CSS only** — background atmosphere, ambient
  spectro glow, a gold hairline plus tidal meander along the top, a dragon-scale band plus
  a ray divider along the bottom, a gold seam on the left edge, and corner meanders with a
  vignette in the foreground.
- **Five hand-drawn SVG ornaments** (`crest`, `scales`, `tide`, `seal`, `feather`),
  monochrome so CSS `mask-image` can tint them per theme.
- **State projection in pure CSS.** `:has()` reads attributes the shell already publishes:
  a gold light sweeps the top bar while streaming, the left seam turns mint while a tool
  runs, the rules turn cinnabar on a failed turn.

### Identity

- **Sidebar brand**: the whale and "DeepSeek Harness" become a round Jinhsi avatar and **今汐**.
- **New-session page**: `探索未至之境 预览版` becomes **桃夭灼灼牵丝动 漂泊者**.
- **Assistant messages** carry a round avatar and render as a "letter" card.

### Feixun conversation

In the DSH shell only *user* messages are bubbles; assistant output is plain markdown.
Rather than reaching into bubble internals (which would need hashed class names), the skin
works from both ends:

| Side | Treatment |
| --- | --- |
| Incoming (assistant) | A card on the chat-flow row itself: asymmetric radius `4px 16px 16px 16px`, gold hairline, a gold "letterhead" tick, avatar at the top-left |
| Outgoing (user) | The bubble colour already flows from `--dsw-specific-bubble` (retuned to a jade tone), plus a small tail aligned to the bubble's top-right corner |

### Wallpaper Engine

When a WE wallpaper is mounted, the skin **gets out of the way** and keeps text readable.
This needed real work — see [How it works](#how-it-works).

- The skin's own backdrop becomes a slider-driven veil instead of an opaque base.
- The ambient glow is withdrawn; the foreground vignette is strengthened.
- Assistant cards are made more opaque so body text sits on something solid.
- All the skin's chrome (gold rules, scales, corner meanders, seal) stays.

Readability has exactly **one** knob: the Skin Center's *background occlusion* slider.

### Persona preset

An optional **Jinhsi** agent persona, installed as a DSH agent preset. It takes the locally
installed `standard` preset and swaps **only the `persona` row** — all 17 other top-level
rows (tools, skills, planning, goals, delegation, compaction…) are preserved, so it remains
a fully capable coding agent that merely speaks in her voice.

The persona maps her character onto engineering behaviour, which turns out to be a direct
translation rather than a stretch:

| Her line | Engineering meaning |
| --- | --- |
| 「我从不打无准备之仗，证据早已由巡宁所收集完毕」 | Read the code, reproduce, gather evidence — *then* conclude |
| 「令尹都会第一时间赶到现场，亲自了解状况」 | Verify the actual state; don't guess or relay |
| 「把民众的细碎愿望翻译成对应的策略」 | Turn a vague request into the next executable step |
| 「没有实绩支撑的笑容会被认为是伪善敷衍」 | No empty promises; speak through verifiable results |
| 「令尹生起气来也不可怕，反倒……令人安心」 | On failure, present evidence and a fix — not emotion |

### Corpus

Everything the reference site publishes about Jinhsi, extracted and decoded: 5 character
stories, 75 voice lines, 17 skill nodes, 6 resonance chains, 2 outfits, 3 collectibles —
9 Markdown files plus the raw JSON, each with a provenance header.

---

## Requirements

| | |
| --- | --- |
| DSH | `>= 0.1.5-rc.1` with the Skin Center (`@linxin666/dsh-client-ui-skin-center`) available |
| OS | Windows (the install scripts are PowerShell) |
| PowerShell | 5.1+ or PowerShell 7 |
| Node.js | **22+** — needed to fetch the artwork, and optionally to compose the persona preset |

Verify your Skin Center is live before installing:

```powershell
Invoke-WebRequest 'http://127.0.0.1:3080/api/skin-center/v2/active' -UseBasicParsing
```

A `200` with `{"ok":true,...}` means you're good. A 404 means the Skin Center is not
mounted and no skin will load.

---

## Install

```powershell
# See what it would do, writing nothing (and downloading nothing)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun

# Skin only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# Skin + the Jinhsi agent persona
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -WithPersona
```

Then **refresh the page** and open **Settings → Skin Center**. The skin appears as
「今汐·洄天溯海」. Click **Try on** first, then **Apply**.

No `dsh` restart is required — a skin is a pure asset directory and the catalog is
re-scanned on page load.

| Target | Path |
| --- | --- |
| Skin | `%USERPROFILE%\.dsh\skins\jinhsi-spectro\` |
| Persona preset (optional) | `%USERPROFILE%\.dsh\.agent-presets\jinhsi\` |

Uninstall:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

The uninstaller only removes directories carrying the correct safety marker (the manifest
`id`, or the preset's `name`), and it is idempotent. It never touches other skins, presets,
credentials or session data.

Full details, troubleshooting and manual installation: **[INSTALL.md](INSTALL.md)** *(Chinese)*.

---

## How it works

This skin targets the Skin Center's **v2 skin contract** rather than the older
`webServer.tapIndex` plugin approach.

### Why not a tampering plugin

An earlier community skin (Mornye Observation Skin) injects HTML via `tapIndex` and matches
CSS-Modules hash class names. That targets `@deepseek-ai/dsh@0.1.0-rc.6`; those hashes no
longer exist in `0.1.5-rc.1`, and the Skin Center registers its own `tapIndex` adapter, so
the two would collide. The v2 skin contract is the supported, version-negotiated
integration point for this release.

### Anchors: official `data-slot` outlets

The Skin Center's renderer wraps every slot in
`<div data-slot="<slotKey>" style="display:contents">`. That is an **official, stable**
anchor owing nothing to hashed class names:

```css
[data-slot="sidebar.brand.mark"] > svg              /* whale → Jinhsi avatar */
[data-slot="sidebar.brand.name"] > svg              /* wordmark → replaced by 今汐 */
[data-slot="conversation.hero.brand.mark"] > svg    /* new-session brand mark */
```

`display: contents` means those wrappers generate no box, so they cannot carry `background`
or `::before` — but their **children** still participate in combinators, so everything is
addressed with structural child selectors.

For the new-session headline there is only one slot anchor in that subtree, and the title
group is its **next sibling**, so `span:has(> [data-slot="…"]) + span` bridges across it.
The title `<span>` carries no class while the badge `<span>` does, which lets
`:not([class])` / `[class]` target them precisely.

### Wallpaper Engine adaptation

Three facts from reading the Skin Center source made this necessary:

| Fact | Source |
| --- | --- |
| WE media sits at `z-index: -3`, its dim veil at `-2` | `wallpaper.ts` header |
| The skin's `background` decoration layer is **also at `-2`** | `decoration-layers.ts` `LAYER_STYLE` |
| The Skin Center's neutralizer covers `html` / `body` / `#root` / `[data-dsh-wallpaper-surface]` — **not `[data-dsh-skin-layer]`** — and media suppression calls `clearLayer()`, which clears only the layer's **children** | `wallpaper.ts`, `skin-controller.ts` |

So without adaptation the skin's opaque backdrop **covers the user's wallpaper entirely**.
The symptom is "I turned the wallpaper on and nothing happened".

The anchor must be `body[data-dsh-wallpaper-active]`, not `html[…]`: the scoping pass only
special-cases `:root` / `html` / `html[data-ds-…]` / `body…`, so an
`html[data-dsh-…]`-leading selector compiles to `html[data-dsh-skin] html[data-dsh-…]` —
requiring an `html` nested inside an `html`, which never matches.
[`tools/validate-skin.mjs`](tools/validate-skin.mjs) replays the scoping algorithm and fails
on any such dead rule, with a `--self-test` proving the check bites.

### Two upstream behaviours worth knowing

- **`data-dsh-part="message-body"` is unreliable.** The compat adapter stamps it from
  `[data-streaming]`, but its MutationObserver only watches `childList` and never removes
  attributes — so historical messages likely never get it. This skin uses
  `[data-chat-flow-kind]`, which the shell writes directly.
- **Indenting chat rows skews wide tables.** `.md-table-wide` breaks out by `100cqw`, and the
  `100%` inside `--dsh-table-lead` is the body's content width. Adding a 46px indent makes
  the table overflow right by exactly that much. The skin compensates explicitly.

Deep dive (Chinese): **[docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md)**

---

## Contract compliance

The Skin Center publishes five contracts. This skin's status:

| Contract | Status |
| --- | --- |
| `skin-manifest-v2.schema.json` | ✅ Validated with `ajv` against the shipped schema; zero catalog diagnostics |
| `semantic-attrs-v1.md` (L2) | ✅ L2 styles `data-dsh-surface` / `data-dsh-part` only — no hashed class names anywhere |
| `official-tokens-v1.json` | ✅ Every remapped `--dsw-*` token is in the 278-entry registry |
| `primary-action-tokens-v1.md` | ✅ All four CTA tokens declared as a matched set per theme (fill / hover / dimmed / foreground); contrast ≈ 6:1, well above the 3:1 warning threshold |
| `performance-guidelines-v1.md` | ✅ R1/R2/R5/R6 N/A (no hooks). R4: **zero** `will-change`; the two `backdrop-filter` uses were removed in favour of opacity. R3: animations are composited and honour `prefers-reduced-motion` — see the deviation note |

**R3 deviation (disclosed):** the guidelines ask infinite animations to pause when the tab is
hidden, which needs a `visibilitychange` listener — impossible without hooks. The one
always-on animation (`jinhsi-drift`, a 26 s composited `transform` on a single layer) is left
running. Chromium suspends compositing for hidden documents, so the practical cost is low,
but this is not literal compliance.

Run the checks yourself:

```powershell
node tools\validate-skin.mjs             # schema, whitelist, scoping dry-run, tokens, contrast
node tools\validate-skin.mjs --self-test # proves the dead-rule detector actually fires
```

---

## Repository layout

```
dsh-jinhsi-skin/
├─ skin/                     ← the skin itself (a pure asset directory)
│  ├─ skin.json              v2 manifest
│  ├─ skin.css               L1 token remap + L2 semantic layer
│  ├─ patches.css            L3 decoration layers + state projection + WE + identity
│  ├─ assets/                5 self-drawn SVGs (committed) + fetched art (git-ignored)
│  ├─ preview/               art-free placeholder previews
│  └─ LICENSE / NOTICE       self-describing copy
├─ persona/                  persona document, injected prompt, preset metadata
├─ corpus/                   all Jinhsi text + raw JSON
├─ docs/                     implementation deep dive + showcase image
├─ tools/                    fetch / validate / preview / extract / compose
├─ install.ps1  uninstall.ps1  push.ps1
└─ LICENSE  NOTICE  INSTALL.md  README.zh-CN.md
```

## Tools

| Script | Purpose |
| --- | --- |
| `tools/fetch-assets.mjs` | Fetch the official artwork locally (`--check`, `--force`) |
| `tools/validate-skin.mjs` | Fail-closed skin validation; `--self-test` |
| `tools/make-preview.mjs` | Render previews via headless Edge/Chrome (`--placeholder`, `--hero`, `--we <img>`) |
| `tools/extract-jinhsi.mjs` | Rebuild `corpus/` from wuther.in, with self-checks |
| `tools/compose-preset.mjs` | Compose the agent preset from the local `standard` preset |
| `tools/preview-mock.html` | Static shell replica used for previews and offline iteration |

---

## Attribution

Full rights breakdown in **[NOTICE](NOTICE)**. In short:

- **Kuro Games** — *Wuthering Waves* and Jinhsi. The character artwork is theirs, is not
  distributed here, and is fetched locally for personal use only.
- **[@linxin666/dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web)**
  (Apache-2.0) — the Skin Center and the v2 contract surface this skin is built entirely
  upon. Without that contract, declarative third-party skins could not exist.
- **DeepSeek Harness** — the host this theme is written for.
- **wuther.in** — the character database the corpus was extracted from.
- **blue-fantasy** (built-in) and **maid-atelier** by Small-tailqwq — references for
  `--dsw-skin-scrim` usage, decoration layers, and the skin directory layout.
- **[is-limo/Mornye-Observation-Skin](https://github.com/is-limo/Mornye-Observation-Skin)**
  — the design idea of a layered observation workbench. That repository is `UNLICENSED`, so
  **no code, CSS, JavaScript or assets were copied from it**; the implementation here is
  independent, and its JS state machine was reimplemented in pure CSS.

This is an unofficial fan project. It is not affiliated with, endorsed by, or supported by
Kuro Games, DeepSeek, or any plugin author mentioned above.

## License

[MIT](LICENSE) for the code, stylesheets, scripts, documentation and original vector
ornaments. The Wuthering Waves character artwork is **not** covered and is not distributed here.

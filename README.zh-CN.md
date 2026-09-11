# 今汐·洄天溯海 — DeepSeek Harness 主题

[English](README.md) | **简体中文**

面向 **DeepSeek Harness** Web GUI 的《鸣潮》主题，角色是今州令尹 **今汐**。

银白、墨黑、金线、淡青与薄荷青——配色是从角色立绘上**取样**得来的，不是凭印象调的。
潮汐回纹与龙鳞纹铺在固定装饰层上，侧栏品牌换成今汐本人，对话界面仿游戏里的**飞讯**。

纯声明式皮肤：不含可执行代码，无遥测，运行时不联网。

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="浅色主题">
  <img src="skin/preview/dark.jpg" width="49%" alt="深色主题">
</p>

---

## ⚠️ 先说清楚：关于美术素材

**本仓库不包含任何库洛游戏的官方美术。**

角色立绘与头像的版权归**库洛游戏**所有。把它们打包进公开仓库等于再分发受版权保护的素材，
所以这里的做法是：

- `skin/assets/*.webp` 已被 **git 忽略**。
- [`tools/fetch-assets.mjs`](tools/fetch-assets.mjs) 在**你的机器上**、安装时从 wuther.in
  的静态资源 CDN 获取它们。来源与 sha256 锚点记录在
  [`tools/asset-sources.json`](tools/asset-sources.json)。
- 仓库里提交的预览图由 `--placeholder` 模式产出：立绘与头像位置用本项目**自绘**的
  「令尹印」替代，因此主题的结构、配色与装饰依然看得见，但不含任何人的美术素材。
  `install.ps1` 会用 `--out-dir` 把真实预览**只生成到安装副本里**，于是本仓库的
  `skin/preview/` 永远是无版权素材的占位版，后续 `git push` 不可能把美术提交上去。

本项目自己创作的部分——代码、样式表、矢量纹样、配色、文档——按 MIT 许可发布。
完整的权利划分见 [NOTICE](NOTICE)。

---

## 特性

### 视觉

- **配色取自立绘取样**，非臆造：瓷白、墨黑、古金、淡青、薄荷青。浅色与深色双主题。
- **六个固定装饰层，全部用 CSS 填充**——背景氛围、环境衍射光晕、顶部金线与潮汐回纹、
  底部龙鳞纹带与羽状分隔、左缘金缝、前景四角回纹与暗角。
- **五张自绘 SVG 纹样**（`crest` / `scales` / `tide` / `seal` / `feather`），单色绘制，
  靠 CSS `mask-image` 上色，自动跟随亮暗主题。
- **纯 CSS 的状态投影。** 用 `:has()` 读取官方壳层已有的属性：生成中顶部金光滑过、
  工具运行时左缘转薄荷青、回合出错时金线转朱砂。

### 身份

- **侧栏品牌**：鲸鱼与「DeepSeek Harness」换成今汐圆形头像与 **今汐**。
- **新对话页**：`探索未至之境 预览版` 换成 **桃夭灼灼牵丝动 漂泊者**。
- **助手消息**左侧带头像，并渲染成一张「来信」卡片。

### 飞讯对话形态

官方壳层里**只有用户消息是气泡**，助手正文是直接铺在背景上的纯 markdown。
本皮肤不去改气泡内部（那需要哈希类名），而是分两头做：

| 方向 | 做法 |
| --- | --- |
| 来信（助手） | 直接做在聊天流条目本体上：不对称圆角 `4px 16px 16px 16px`、金色发丝边框、金色「信笺抬头」、左上角头像 |
| 去信（用户） | 气泡配色由 `--dsw-specific-bubble` 驱动（已改为青玉调），再补一个对齐气泡右上角的小尖角 |

### Wallpaper Engine

挂上 WE 壁纸时，皮肤会**主动让位**并保住正文可读性。这件事需要真功夫——见下文。
立绘底改为随滑杆变浓的纱幕、收起环境光晕、加强前景暗角、把来信卡片调实；
金线、龙鳞、四角回纹、令尹印全部保留。

可读性只有**一个**旋钮：皮肤中心的「背景遮蔽」滑杆。

### 人格预设

可选的**今汐** Agent 人格。它取本机已装的 `standard` 预设，**只替换 `persona` 行**，
其余 17 个顶层行（工具、技能、计划、目标、委派、压缩…）原样保留——所以它依然是一个
能力完整的编码 Agent，只是换了谁在说话。

人设把她的性格直译成工程行为，而这并不是硬拗，原文本来就长这样：

| 她的原话 | 工程上的含义 |
| --- | --- |
| 「我从不打无准备之仗，证据早已由巡宁所收集完毕」 | 先读代码、先复现、先取证，再下结论 |
| 「令尹都会第一时间赶到现场，亲自了解状况」 | 亲自核实现状，不靠猜测转述 |
| 「把民众的细碎愿望翻译成对应的策略」 | 把含糊需求翻译成可执行的下一步 |
| 「没有实绩支撑的笑容会被认为是伪善敷衍」 | 不空口承诺，用可验证的结果说话 |
| 「令尹生起气来也不可怕，反倒……令人安心」 | 发现问题时给依据与修复路径，而不是情绪 |

### 语料

参考站点上关于今汐的全部文本，已提取并解码：5 篇角色故事、75 条语音、17 个技能节点、
6 段共鸣链、2 套服饰、3 件藏品——9 份 Markdown 加原始 JSON，每份都带溯源头。

---

## 环境要求

| | |
| --- | --- |
| DSH | `>= 0.1.5-rc.1`，且**皮肤中心**（`@linxin666/dsh-client-ui-skin-center`）可用 |
| 系统 | Windows（安装脚本是 PowerShell） |
| PowerShell | 5.1+ 或 PowerShell 7 |
| Node.js | **22+**——获取美术素材需要；合成人格预设可选 |

安装前先确认皮肤中心在线：

```powershell
Invoke-WebRequest 'http://127.0.0.1:3080/api/skin-center/v2/active' -UseBasicParsing
```

返回 `200` 与 `{"ok":true,...}` 即正常。返回 404 说明皮肤中心没挂载，装了也不会加载。

---

## 安装

```powershell
# 先看会做什么，不写任何文件（也不会下载）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun

# 只装皮肤
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# 皮肤 + 今汐人格预设
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -WithPersona
```

然后**刷新页面**，打开 **设置 → 皮肤中心**，列表里出现「今汐·洄天溯海」。
先点**试穿**，满意再点**应用**。

**不需要重启 `dsh`**——皮肤是纯资产目录，目录册在页面加载时重新扫描。

| 目标 | 路径 |
| --- | --- |
| 皮肤 | `%USERPROFILE%\.dsh\skins\jinhsi-spectro\` |
| 人格预设（可选） | `%USERPROFILE%\.dsh\.agent-presets\jinhsi\` |

卸载：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

卸载器只删除带正确安全标记的目录（manifest 的 `id`，或预设的 `name`），且幂等。
它不会触碰其他皮肤、预设、凭据或会话数据。

完整说明、排错与手工安装见 **[INSTALL.md](INSTALL.md)**。

---

## 实现要点

本皮肤面向皮肤中心的 **v2 皮肤契约**，而不是早期的 `webServer.tapIndex` 插件形态。

### 为什么不用篡改式插件

更早的社区皮肤（Mornye Observation Skin）通过 `tapIndex` 注入 HTML 并匹配
CSS-Modules 哈希类名。那套面向 `@deepseek-ai/dsh@0.1.0-rc.6`，而那些哈希在
`0.1.5-rc.1` 上已不存在；皮肤中心自己也注册了 `tapIndex` 适配器，两套会互相打架。
v2 皮肤契约才是这个版本上受支持、可版本协商的集成点。

### 锚点：官方 `data-slot` 出口

皮肤中心的 renderer 把每个 slot 渲染成
`<div data-slot="<slotKey>" style="display:contents">`。这是**官方且稳定**的锚点，
不依赖任何哈希类名：

```css
[data-slot="sidebar.brand.mark"] > svg              /* 鲸鱼 → 今汐头像 */
[data-slot="sidebar.brand.name"] > svg              /* 字标 → 换成「今汐」 */
[data-slot="conversation.hero.brand.mark"] > svg    /* 新对话页品牌标记 */
```

`display: contents` 的元素自身不生成盒子，因此不能承载 `background` 或 `::before`；
但它们的**子元素**照常参与组合器，所以一律用结构化子选择器。

新对话页抬头那一段只有**一个** slot 锚点，标题组是它的**下一个兄弟**，于是用
`span:has(> [data-slot="…"]) + span` 横跨过去。标题那个 `<span>` 没有 class、徽标那个有，
所以 `:not([class])` / `[class]` 能精确定位。

### Wallpaper Engine 适配

读皮肤中心源码后确认的三个事实，让这件事成为必须：

| 事实 | 出处 |
| --- | --- |
| WE 媒体层在 `z-index: -3`，压暗遮罩在 `-2` | `wallpaper.ts` 头部注释 |
| 本皮肤的 `background` 装饰层**同样在 `-2`** | `decoration-layers.ts` 的 `LAYER_STYLE` |
| 皮肤中心的中和样式覆盖 `html` / `body` / `#root` / `[data-dsh-wallpaper-surface]`——**不覆盖 `[data-dsh-skin-layer]`**；抑制皮肤媒体时走 `clearLayer()`，只清层的**子节点** | `wallpaper.ts`、`skin-controller.ts` |

所以不做适配，皮肤的不透明底会**把用户的壁纸整个盖住**，现象就是「壁纸开了但没反应」。

锚点必须是 `body[data-dsh-wallpaper-active]` 而不是 `html[…]`：作用域化只对
`:root` / `html` / `html[data-ds-…]` / `body…` 开头做特判，以 `html[data-dsh-…]` 开头的
选择器会被拼成 `html[data-dsh-skin] html[data-dsh-…]`——要求 html 嵌套在 html 里，永不匹配。
[`tools/validate-skin.mjs`](tools/validate-skin.mjs) 会复刻这套算法并判死这类规则，
`--self-test` 证明判死逻辑真的会触发。

### 两个值得知道的上游行为

- **`data-dsh-part="message-body"` 不可靠。** 兼容适配器是从 `[data-streaming]` 盖章的，
  但它的 MutationObserver 只监听 `childList`、从不撤销属性——历史消息很可能从未被盖上。
  本皮肤改用官方直接写在 flowItem 上的 `[data-chat-flow-kind]`。
- **给聊天行加缩进会顶歪宽表格。** `.md-table-wide` 按 `100cqw` 破格，而 `--dsh-table-lead`
  里的 `100%` 是正文内容宽。加 46px 缩进会让表格向右溢出恰好这么多。本皮肤做了对等补偿。

更长的技术长文：**[docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md)**

---

## 契约合规

皮肤中心发布了五份契约，本皮肤的状态：

| 契约 | 状态 |
| --- | --- |
| `skin-manifest-v2.schema.json` | ✅ 用 `ajv` 对官方 schema 真校验通过；目录册零诊断 |
| `semantic-attrs-v1.md`（L2） | ✅ L2 只用 `data-dsh-surface` / `data-dsh-part`，全程零哈希类名 |
| `official-tokens-v1.json` | ✅ 所有重映射的 `--dsw-*` token 都在 278 项注册表内 |
| `primary-action-tokens-v1.md` | ✅ 四个 CTA token 双主题成对声明（fill / hover / dimmed / foreground）；对比度约 6:1，远高于 3:1 告警线 |
| `performance-guidelines-v1.md` | ✅ R1/R2/R5/R6 不适用（无 hooks）。R4：**零** `will-change`，两处 `backdrop-filter` 已移除改用不透明度。R3：动画均为合成属性且尊重 `prefers-reduced-motion`——偏差见下 |

**R3 偏差（如实披露）：** 规范要求无限动画在标签页隐藏时暂停，这需要
`visibilitychange` 监听器——没有 hooks 就做不到。唯一常驻的动画
（`jinhsi-drift`，单层 26 秒合成 `transform`）保持运行。Chromium 会挂起隐藏文档的合成，
实际开销很低，但这不算字面合规。

自己跑一遍：

```powershell
node tools\validate-skin.mjs             # schema、白名单、作用域预演、token、对比度
node tools\validate-skin.mjs --self-test # 证明死规则检测真的会触发
```

---

## 目录结构

```
dsh-jinhsi-skin/
├─ skin/                     ← 皮肤本体（纯资产目录）
│  ├─ skin.json              v2 manifest
│  ├─ skin.css               L1 token 重映射 + L2 语义层
│  ├─ patches.css            L3 装饰层 + 状态投影 + WE 适配 + 身份层
│  ├─ assets/                5 张自绘 SVG（入库）+ 官方美术（git 忽略，本机获取）
│  ├─ preview/               不含官方美术的占位预览
│  └─ LICENSE / NOTICE       自描述副本
├─ persona/                  人格文档、注入文本、预设元数据
├─ corpus/                   今汐语料 + 原始 JSON
├─ docs/                     实现长文 + 效果图
├─ tools/                    获取 / 校验 / 预览 / 提取 / 合成
├─ install.ps1  uninstall.ps1  push.ps1
└─ LICENSE  NOTICE  INSTALL.md  README.md
```

## 工具

| 脚本 | 用途 |
| --- | --- |
| `tools/fetch-assets.mjs` | 在本机获取官方美术（`--check`、`--force`） |
| `tools/validate-skin.mjs` | 皮肤 fail-closed 自检；`--self-test` |
| `tools/make-preview.mjs` | 用 headless Edge/Chrome 渲染预览（`--placeholder`、`--hero`、`--we <图>`、`--out-dir <目录>`） |
| `tools/extract-jinhsi.mjs` | 从 wuther.in 重建 `corpus/`，含自检断言 |
| `tools/compose-preset.mjs` | 基于本机 `standard` 预设合成 Agent 预设 |
| `tools/preview-mock.html` | 壳层静态复刻，供预览与离线调试 |

---

## 致谢

完整的权利划分见 **[NOTICE](NOTICE)**。简要：

- **库洛游戏（Kuro Games）**——《鸣潮》与今汐。角色美术版权归其所有，本仓库不分发，
  由安装脚本在本机获取，仅限个人使用。
- **[@linxin666/dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web)**
  （Apache-2.0）——皮肤中心与 v2 契约面。本皮肤完全建立在其之上；
  没有这份契约面，纯声明式的第三方皮肤不可能存在。
- **DeepSeek Harness**——本主题所面向的宿主。
- **wuther.in**——语料的提取来源。
- **蓝色幻想**（内置）与 **深海女仆工坊**（作者 Small-tailqwq）——`--dsw-skin-scrim` 用法、
  装饰层用法与皮肤目录布局的参照。
- **[is-limo/Mornye-Observation-Skin](https://github.com/is-limo/Mornye-Observation-Skin)**
  ——「分层观测工作台」的设计思路来源。该仓库标记为 `UNLICENSED`，因此
  **未复制其任何代码、CSS、JavaScript 或资源**；此处为独立实现，
  其 JS 状态机已改用纯 CSS 重新实现。

本项目是非官方粉丝作品，与库洛游戏、DeepSeek 及上述任何插件作者均无隶属、背书或支持关系。

## 许可

代码、样式表、脚本、文档与自绘矢量纹样采用 [MIT](LICENSE) 许可。
《鸣潮》角色美术**不在**该许可范围内，且本仓库不分发这部分内容。

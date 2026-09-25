# 今汐·洄天溯海 — DSH 主题包

《鸣潮》今州令尹**今汐**的 DeepSeek Harness 主题。包含一个皮肤中心 v2 皮肤
与一份从 wuther.in 提取的今汐语料。

---

## 这个包是什么

| 组成 | 位置 | 说明 |
| --- | --- | --- |
| **皮肤（"插件"本体）** | `skin/` | 符合 DSH 皮肤中心 **v2 皮肤契约**的纯资产目录。装进 `$DSH_HOME/skins/` 后在「设置 → 皮肤中心」试穿/应用，**无需重启** |
| **语料** | `corpus/` | 从 wuther.in 提取的**全部**今汐文本，9 份 Markdown + 2 份原始 JSON |
| **安装器** | `install.ps1` / `uninstall.ps1` | 幂等、带安全标记校验、失败回滚 |
| **工具** | `tools/` | 抓取、校验、预览生成、预设合成，全部可复现 |

## 快速开始

```powershell
# 1) 只装皮肤
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# 2) 先看会做什么，不写任何文件
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun
```

装完刷新浏览器页面，打开 **设置 → 皮肤中心**，列表里会出现「今汐·洄天溯海」。
先点**试穿**，满意再点**应用**。

卸载：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

细节、排错与手工安装见 **[INSTALL.md](INSTALL.md)**。

---

## 皮肤长什么样

配色直接取自角色立绘取样：**银白 / 墨黑 / 金线 / 淡青 / 薄荷青**，不是凭印象调的。

| | 浅色「溯海晴光」 | 深色「洄天溯海」 |
| --- | --- | --- |
| 底 | 瓷白 `#F4F7FA` | 墨夜 `#0C0F13` |
| 主色 | 青金 `#39697A` | 冰蓝 `#8FC3D0` |
| 金线 | `#A8892B` | `#DFC078` |
| 薄荷 | `#4E8C7C` | `#7FBFAD` |

预览图在 `skin/preview/`（`light.jpg` / `dark.jpg`，1280×800）。

### 装饰层：没有一行 JS

皮肤中心提供 6 个固定装饰层，本皮肤全部用 CSS 填充：

| 层 | 内容 |
| --- | --- |
| `background` | 立绘 + 氛围渐变（底色、衍射微光、薄荷青光） |
| `ambient` | 缓慢漂移的衍射光晕 + 令尹印水印 |
| `top` | 金线 + 潮汐回纹带 |
| `bottom` | 金线 + 龙鳞纹带 + 居中衍射分隔纹 |
| `sidebar` | 左缘金缝 |
| `foreground` | 四角回纹 + 暗角 |

自绘纹样（`crest.svg` / `scales.svg` / `tide.svg` / `seal.svg` / `feather.svg`）
全部是单色 SVG，通过 CSS `mask-image` 上色，因此自动跟随亮/暗主题。

### 状态投影：也是纯 CSS

用 `:has()` 读取官方壳层**已有**的属性，不新增任何运行时：

| 条件 | 反应 |
| --- | --- |
| `[data-streaming]` | 顶线金光滑过，环境光晕加速 |
| `[data-chat-flow-kind="tool-call"]` | 左缘金缝转薄荷青并脉动 |
| `[data-chat-flow-kind="turn-error"]` | 上下金线转朱砂 |
| `html[data-dsh-conversation-content]` | 空对话时收敛水印 |

### 与皮肤中心滑杆协同

所有本该半透的底色都乘上 `var(--dsw-skin-scrim, 0)`，因此「背景遮蔽」滑杆真实生效。
底色在滑杆为 0 时**完全透明**，立绘才能透出来；可读性由 manifest 的 `backgroundMedia.scrim`
负责，而不是靠压暗整张底。

### Wallpaper Engine 适配

效果对照图：`we-adaptation.jpg`（用你自己的壁纸「鸣潮-今汐」渲染，遮蔽值取你当前的 50）。

**为什么必须专门写这段。** 读皮肤中心源码后确认的三个事实：

| 事实 | 出处 |
| --- | --- |
| WE 壁纸的**媒体层在 `z-index:-3`**，压暗遮罩在 `-2` | `wallpaper.ts` 顶部注释 |
| 本皮肤的 `background` 装饰层**同样在 `-2`** | `decoration-layers.ts` 的 `LAYER_STYLE` |
| 皮肤中心的中和样式只覆盖 `html` / `body` / `#root` / `[data-dsh-wallpaper-surface]` / `[data-composer-seat]::before`，**不覆盖 `[data-dsh-skin-layer]`**；而控制器抑制皮肤背景媒体时走 `clearLayer()`，**只清层的子节点**，层元素与其身上的 CSS 底色原样留着 | `wallpaper.ts` 的 `rootNeutralizer`、`skin-controller.ts` |

结论：皮肤若不自己让位，那层不透明底色会把用户挑的壁纸**整个盖住**——现象是「壁纸开了但没反应」。
所以 `patches.css` 里有一段专门的适配，做四件事：

1. **背景层由「底」改「纱」**：不再画自己的渐变，改为随遮蔽滑杆变浓的半透明纱幕。
   它夹在壁纸（-3）与面板之间，是加纱的正确位置——直接设成 `transparent`
   会把中栏正文晾在壁纸上。
2. **环境层收起衍射光晕**：那圈暖雾是专为自有底色打的，压在任意壁纸上会显脏。
3. **前景层加强暗角**：让不可控的壁纸内容与界面四边过渡干净。
4. **消息行与会话头补一层「笺纸」**：官方壳层的中栏根节点会被皮肤中心
   强制透明（`[data-dsh-wallpaper-surface]`），纱幕之外还得给正文一张纸。

金线、龙鳞纹、四角回纹、令尹印一概保留——壁纸之下，这些才是皮肤还在场的证据。

**锚点为什么是 `body[...]` 而不是 `html[...]`。** 这是个非常容易踩、而且**不会报错**的坑：
加载器的作用域化只对 `:root` / `html` / `html[data-ds-…]` / `body…` 开头做特判，
`html[data-dsh-wallpaper-active]` 不匹配任何一条（注意是 `data-dsh-`，不是 `data-ds-`），
于是会被拼成 `html[data-dsh-skin="…"] html[data-dsh-wallpaper-active] …`——
要求 `html` 嵌套在 `html` 里，**永远匹配不到**。

`tools/validate-skin.mjs` 现在会复刻这套作用域化逻辑做预演，并带 `--self-test` 证明判死有效：

```sh
node tools/validate-skin.mjs --self-test
```

> 这个检查是被现实打出来的：本皮肤早先有一条
> `html[data-dsh-conversation-content="false"] …` 的死规则，
> 语法合法、lightningcss 照过、离线自检全绿，但线上从未生效。
> 顺带还查清该属性是「**存在即真**」——空对话时是被 `removeAttribute` 掉的，
> 不存在 `="false"`，所以正确的写法是 `body:not([data-dsh-conversation-content])`。

**可读性怎么调。** 「背景遮蔽」滑杆是唯一的旋钮，同时驱动纱幕与面板不透明度：

| 滑杆 | 纱幕 α（浅色） | 效果 |
| --- | --- | --- |
| 0 | 0.26 | 壁纸最清晰，正文靠「笺纸」卡片托住 |
| 50（默认） | 0.54 | 平衡 |
| 100 | 0.82 | 最实，接近不用壁纸 |

两种极端都验证过：正文均可读，不存在「拉到某处突然看不清」的悬崖。
壁纸自带的「压暗」设置仍然独立生效，两者叠加即可。

---

## 身份层：今汐的头像与「飞讯」对话形态

配色和装饰只是皮，还缺一层**身份**——左上角是不是今汐、消息旁边有没有她的脸。
这两件事只靠 CSS 做，锚点全部来自**官方 slot 出口**。

### 关键发现：slot 出口自带 `data-slot`

皮肤中心依赖的 renderer 里，每个 slot 都渲染成：

```jsx
function SlotOutlet({ slotKey, … }) {
  return <div data-slot={slotKey} style={{ display: "contents" }}>…</div>
}
```

于是 `[data-slot="sidebar.brand.mark"]`、`[data-slot="sidebar.brand.name"]`、
`[data-slot="conversation.hero.brand.mark"]` 都是**官方稳定锚点**，
不依赖任何 CSS-Modules 哈希类名，官方重建样式也不会失效。

`display:contents` 的元素自身不生成盒子（所以不能在它身上加 `background` / `::before`），
但它的**子元素照常参与 DOM 组合器**——因此一律走 `> svg` / `> span` 这类结构化子选择器。

### 做了什么

| 位置 | 改动 | 选择器 |
| --- | --- | --- |
| 侧栏左上角品牌标记 | 灰鲸鱼 → 今汐圆形头像（金环 + 青玉光晕） | `[data-slot="sidebar.brand.mark"] > svg` |
| 侧栏左上角品牌名 | `DeepSeek Harness` → **今汐** | `span:has(> [data-slot="sidebar.brand.name"])::after` |
| 空对话欢迎区 | 同一个头像，放大到 56px | `[data-slot="conversation.hero.brand.mark"] > svg` |
| 新对话页抬头 | `探索未至之境` → **桃夭灼灼牵丝动**；`预览版` → **漂泊者** | 见下 |
| 每一条助手消息 | 左侧圆形今汐头像 | `[data-chat-flow-kind="assistant-step"]::before` |

### 改文案怎么改（CSS 改不了文本）

CSS 不能改文本内容，所以走标准做法：**把原文案 `font-size` 归零藏起来，再用 `::after` 注入新文案**。
原文仍留在 DOM 里（对读屏与复制友好），行高与内边距都继承原值，布局完全不变。

难点在**定位**。`ui-conversation` 的 `HeroShell`（14619-14649 行）结构是：

```
div.headline
  ├─ span.fishHitbox  > div[data-slot="conversation.hero.brand.mark"]
  └─ span.titleGroup  > [ <span>探索未至之境</span>,
                          <span class="…previewBadge">预览版</span> ]
```

这一带**只有 `conversation.hero.brand.mark` 一个 slot 出口**可作稳定锚点，
标题组是它的**下一个兄弟**，所以用：

```css
span:has(> [data-slot="conversation.hero.brand.mark"]) + span > span:not([class])::after { content: "桃夭灼灼牵丝动"; }
span:has(> [data-slot="conversation.hero.brand.mark"]) + span > span[class]::after   { content: "漂泊者"; }
```

区分的技巧：标题那个 `<span>` **没有 class**（JSX 里只传了 children），徽标那个**有 class**。
用 `:not([class])` / `[class]` 比 `:first-child` / `:last-child` 稳——
万一将来只渲染一个，前者不会产生歧义。

抬头悬在立绘或壁纸之上、背景明暗不可控，所以标题加了一圈同色系柔光作衬，
徽标底色取近乎实心的 `--jinhsi-porcelain-hi`（半透明 chip 会直接糊掉）。
字号 26px 属「大字」，WCAG AA 门槛为 3:1，自检里已按 3:1 纳入。

> **踩过的坑**：本机 profile 启用了官方品牌插件 `ui-brand-official`，
> 它注册了 `sidebar.brand.mark` / `sidebar.brand.name` 两个 slot，
> 所以**两个 fallback 分支都不渲染**——实际 DOM 里名字是 BrandWordmark 的
> **156×24 `<svg>` 字形路径**，不是 fallback 的 `<span>`。
> 一开始按 `<span>` 写的规则在真机上是空转的，读了 sidebar 与 brand-official 的
> 源码才纠正过来。

### 对话形态：仿《鸣潮》飞讯

官方壳层里**只有用户消息是气泡**，助手正文是直接铺在背景上的纯 markdown。
所以这里不试图去改气泡内部（那需要 `[class*=…]` 哈希类名），而是分两头做：

- **来信（助手）** —— 在聊天流条目本体 `[data-chat-flow-kind="assistant-step"]`
  （真实盒子，`::before`/`::after` 可用）上直接做一张卡片：
  不对称圆角 `4px 16px 16px 16px`（左上留小圆角给头像）、金色发丝边框、
  顶部一道金色「信笺抬头」，头像坐在左上角。
- **去信（用户）** —— 气泡配色本来就由 `--dsw-specific-bubble` 驱动
  （已改为青玉调），这里只在条目右侧补一个去信小尖角，
  位置天然对齐气泡右上角。

### 又两个必须记住的坑

**1. `data-dsh-part="message-body"` 不能当主选择器。**
契约里它是「助手正文」的语义锚，但兼容适配器是从 `[data-streaming]` 盖章的，
而它的 MutationObserver **只监听 `childList`、且 `applyRule` 从不撤销属性**——
于是历史消息（挂载时就已不是流式）很可能从未被盖上这个标记。
本皮肤因此改用官方直接写在 flowItem 上的 `[data-chat-flow-kind="assistant-step"]`。

**2. 给 flowItem 加左缩进会顶歪宽表格。**
`.md-table-wide` 按 `100cqw` 破格：

```css
--dsh-table-lead: calc(var(--dsh-table-spare) + min(var(--dsh-chat-content-width), 100cqw) - 100%);
width: calc(100% + var(--dsh-table-lead) + var(--dsh-table-spare));
```

其中 `100%` 是 `.md-table-body` 的内容宽。加了 46px 缩进后 `100%` 少 46px，
`--dsh-table-lead` 反而多 46px，整张表**向右溢出 46px**。
皮肤里做了对等补偿：

```css
[data-chat-flow-kind="assistant-step"] .md-table-wide {
  width: calc(100% + var(--dsh-table-lead) + var(--dsh-table-spare) - var(--jinhsi-avatar-gutter));
}
```

（`.md-table-wide` 是 markdown 渲染器输出的语义类名，不是 CSS-Modules 哈希，可安全依赖。）

缩进量统一由 `--jinhsi-avatar-gutter` 控制，改一处即可。

---

## 语料



从 `https://wuther.in/data/{version}/zh-Hans/character/1304.json` 与
`.../character-story-voice/1304.json` 提取（当前数据版本 `3.5.5`）。

| 文件 | 内容 |
| --- | --- |
| `00-索引.md` | 数据规模、文件导航、原始文件指纹、解码约定 |
| `01-角色档案.md` | 身份、简介、频谱检验报告、诊断结果、标签、声优、术语表 |
| `02-属性与突破.md` | 三维成长表、基础战斗属性、突破与等级经验 |
| `03-技能.md` | 技能树 17 节点全文、机制说明、操作输入、升级材料 |
| `04-共鸣链.md` | 共鸣链 6 段全文 |
| `05-角色故事.md` | 角色故事 5 篇全文 |
| `06-语音.md` | 语音 75 条全文，按档案类 / 实战类分组 |
| `07-服饰与藏品.md` | 服饰 2 套、藏品 3 件、专属料理 |
| `08-养成材料与配装.md` | 推荐武器、材料总表、各节点消耗 |

站点使用私有富文本标记（`<te href=…>`、`<color=Highlight>`、`{0}` 参数占位等），
提取脚本会全部解码，并在收尾自检里**断言**没有残留：
参数占位符全部展开、富文本标签全部解码、条目数与源数据一致、故事与语音全文逐条比对通过。

重新生成（站点数据更新后用）：

```sh
node tools/extract-jinhsi.mjs            # 复用 corpus/raw 缓存
node tools/extract-jinhsi.mjs --refresh  # 强制重新下载
```

脚本不写死版本号：会按站点的版本候选表逐个回退，并核对 `1304` 的名字确实是「今汐」。

---

## 工具

| 脚本 | 用途 |
| --- | --- |
| `tools/extract-jinhsi.mjs` | 从 wuther.in 抓取并生成 `corpus/`，含 4 项自检断言 |
| `tools/validate-skin.mjs` | 皮肤 fail-closed 自检（见下）；`--self-test` 验证作用域判死逻辑 |
| `tools/make-preview.mjs` | 用 headless Edge 渲染 `tools/preview-mock.html` 并抓 `preview/*.jpg`；`--we <图>` 额外出一张 WE 适配对照图 |
| `tools/preview-mock.html` | 壳层静态复刻，供预览与离线调试（皮肤本身不含 JS） |

### 皮肤自检覆盖

```
node tools/validate-skin.mjs
```

1. **官方 JSON Schema 真校验** —— 用 ajv 跑皮肤中心自带的
   `contracts/skin-manifest-v2.schema.json`
2. **CSS 加载器白名单** —— 禁 `@import`、禁远程 / 协议相对 / 绝对路径 / `../` 逃逸；
   每个 `url()` 目标必须真实存在于 `skin/` 内
3. **作用域化预演** —— 复刻加载器的 `scopeSelectorText`，抓出「语法合法但永不匹配」的死规则
4. **lightningcss 真解析** —— 与皮肤中心同一条解析路径，语法错会 fail-closed
5. **token 名核对** —— `--dsw-*` 必须来自官方 278 项注册表
6. **WCAG AA 对比度** —— 12 组前景/背景组合
7. 告警项：`[class*=…]` 哈希类名依赖、通用 `@keyframes` 名

---

## 隐私与边界

- 皮肤是**纯声明式资产目录**：`skin.json` + 两份 CSS + 图片。**不含任何可执行代码**，
  不声明 `facets.client` / `hooks.mjs`。
  （这既是安全选择，也是技术必然：皮肤中心对本地皮肤目录的执行身份做 provenance 校验，
  非官方市场来源的 `hooks.mjs` 会被拒绝。声明它只会在目录里留一条无用的诊断。）
- 不写入 API Key、凭据、`.env`、`.credentials.yaml`、会话记录或本机用户路径。
- 不修改 `cordis.patch.yml`，不添加 npm 依赖，不改动任何其他皮肤或预设。
- 安装器只创建 `$DSH_HOME/skins/jinhsi-spectro/`；卸载器带安全标记校验，只在标记匹配时删除它。
- 皮肤不联网。装饰层与状态投影全部是 CSS，无遥测、无远程脚本、无 CDN。

### 美术归属

- **动态壁纸背景**（`jinhsi-quiet.mp4`，1920×1080 / 8 秒 / H.264，亮暗共用同一段）取自
  Wallpaper Engine 创意工坊 item 3606711102「今汐——安静」的本机导出件：画面是官方今汐美术
  （© 库洛游戏），场景工程归壁纸原作者。它没有可下载的官方地址，因此**随包分发**——
  否则别的机器装上皮肤就没有底图；相关声明见 `../NOTICE` 与 `../skin/skin.json`。
- **头像**（`jinhsi-head.webp`）取自 wuther.in 站点静态资源，版权归**库洛游戏**所有，
  **仅限本机个人使用，不得再分发**。
- **装饰纹样**（`crest.svg` / `scales.svg` / `tide.svg` / `seal.svg` / `feather.svg`）
  为原创绘制，随本包自由使用。

### 关于参考实现

本包在设计意图上参考了社区皮肤 `is-limo/Mornye-Observation-Skin` 的**分层观测工作台**思路
（顶部/底部饰条、环境层、状态投影）。该仓库标记为 `UNLICENSED`，
因此**没有复制它的任何 CSS / JS / 资源**——所有代码与纹样均为原创，
状态投影也改用纯 CSS 的 `:has()` 实现，而非它的 JS 状态机。

同时说明为什么没有沿用它的插件形态：它面向 `@deepseek-ai/dsh@0.1.0-rc.6`，
通过 `webServer.tapIndex` 注入 HTML 并硬编码 CSS-Modules 哈希类名；
本机 DSH 为 `0.1.5-rc.1`，那些哈希类名已全部失效，
而且皮肤中心本身就注册了 tapIndex 适配器，两套会互相打架。
皮肤中心 v2 皮肤契约才是这个版本上受支持、可版本协商的集成点。

---

## 兼容性

- DSH `>= 0.1.5-rc.1`（皮肤中心 `@linxin666/dsh-client-ui-skin-center` v2 契约）
- Windows PowerShell 5.1+ / PowerShell 7
- Node.js 22+（工具脚本需要；只装皮肤不需要）

---

## 已知限制

- **本地皮肤不运行 hooks。** 皮肤中心对本地目录做执行身份 provenance 校验，
  非官方市场来源的 `hooks.mjs` 会被拒绝。本皮肤因此完全声明式，
  装饰全部走 CSS 与 6 个固定装饰层。
- **预览图不是真机截图。** `preview/*.jpg` 由 `tools/preview-mock.html`
  （按官方语义属性搭的静态壳层）经 headless Edge 渲染而来。
  它反映皮肤真实的渲染结果，但不等于 DSH 运行时截图。
- **真实布局的类名无关。** 皮肤只使用官方 token 与 `data-dsh-surface` / `data-dsh-part`
  语义属性，不匹配任何 CSS-Modules 哈希类名，因此官方重建样式不会让它失效。
  代价是：不输出语义属性的第三方插件区域只享受 L1 token 覆盖。
- **`:has()` 需要 Chromium。** DSH Web GUI 只跑 Chromium，安全；
  状态投影是纯增益，不生效也不影响基础皮肤。
- **`data-dsh-part="message-body"` 不可靠。** 契约把「助手正文」的语义锚定义为
  `[data-streaming]` 根，而兼容适配器的 MutationObserver 只监听 `childList`、
  `applyRule` 也从不撤销属性——历史消息（挂载时就已不是流式）很可能从未被盖章。
  本皮肤因此不用它，改用官方直接写在 flowItem 上的 `[data-chat-flow-kind]`。
  这是上游适配器的行为，不是本皮肤的缺陷，但依赖该标记的第三方皮肤会踩到。
- **`sidebar.brand.mark` 有两个出口**（侧栏宽态的 `brandMark` 与窄态的 `railMark`），
  皮肤两条都覆盖；折叠侧栏时头像同样生效。
- **`--dsh-alias-tooltip-fg` 不在官方 token 快照内。** 快照记录的是壳层「定义过」的 token，
  壳层消费但从未定义的 token 不在其中，因此这条通常无害。自检会把它列为说明项而非错误。
- **皮肤中心被停用时**，皮肤目录会静置在 `$DSH_HOME/skins/` 不生效，
  外观回退「官方默认」；这不会报错，也不需要清理。

---

## 目录结构

```
jinhsi-spectro/
├─ README.md                 本文件
├─ we-adaptation.jpg         Wallpaper Engine 适配对照图
├─ hero.jpg                  新对话页抬头对照图
├─ skin/                     ★ 皮肤本体（纯资产目录）
│  ├─ skin.json              manifest v2
│  ├─ skin.css               L1 token 重映射 + L2 语义层
│  ├─ patches.css            L3 装饰层 + 状态投影 + WE 适配
│  ├─ assets/                动态壁纸 + 自绘 SVG（头像于安装时取回）
│  └─ preview/               light.jpg / dark.jpg
├─ corpus/                   ★ 今汐语料
│  ├─ 00-索引.md … 08-养成材料与配装.md
│  └─ raw/                   原始 JSON
└─ tools/                    抓取 / 校验 / 预览
```

---

## 授权

- 代码、CSS、自绘纹样、语料整理与文档：随本包自由使用。
- 动态壁纸画面与头像：© Kuro Games，见上文「美术归属」。
- 《鸣潮》/ Wuthering Waves 及相关角色为库洛游戏商标与版权内容。
  本包是非官方第三方主题，与库洛游戏、DeepSeek 均无隶属或背书关系。

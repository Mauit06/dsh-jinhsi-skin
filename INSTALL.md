# 安装 · 激活 · 排错 · 卸载

面向 [README.md](README.md) 里那份今汐主题包的完整操作说明。

---

## 0. 前置条件

> **官方美术会在安装时从网上获取。** 角色立绘与头像版权归库洛游戏，本仓库**不分发**它们。
> 首次运行 `install.ps1` 时会自动从 wuther.in 的静态资源 CDN 下载到
> `skin/assets/`（来源与 sha256 见 `tools/asset-sources.json`），并在素材到位后
> 重新生成真实预览图。想先单独获取或检查：
>
> ```powershell
> node tools\fetch-assets.mjs --check   # 只检查缺哪些
> node tools\fetch-assets.mjs           # 补齐缺失
> node tools\fetch-assets.mjs --force   # 全部重下
> ```
>
> 所以**首次安装需要 Node.js 22+ 与网络**。若你已在别处备好这 5 个文件，
> 直接放进 `skin\assets\`（文件名必须一致）就不会触发下载。

| 项 | 要求 | 怎么确认 |
| --- | --- | --- |
| DSH | `>= 0.1.5-rc.1`，且**皮肤中心在线** | 见下方「确认皮肤中心在线」 |
| PowerShell | Windows PowerShell 5.1+ 或 PowerShell 7 | `$PSVersionTable.PSVersion` |
| Node.js | 22+（**只有**人格预设合成与工具脚本需要） | `node --version` |
| 浏览器 | Chromium 系（DSH Web GUI 本身就是） | — |

### 确认皮肤中心在线

皮肤由 `@linxin666/dsh-client-ui-skin-center` 加载。它在线时，下面这个请求返回 `200`：

```powershell
Invoke-WebRequest 'http://127.0.0.1:3080/api/skin-center/v2/active' -UseBasicParsing |
  Select-Object StatusCode, Content
```

预期形如：

```json
{"ok":true,"active":"blue-fantasy","background":{...}}
```

若返回 404 / 连接被拒，说明皮肤中心没挂载（或 DSH 没在 3080 上跑）。
此时皮肤不会被加载——先修好皮肤中心，再回来装本主题。

> 皮肤中心在 `profiles/web/package.json` 的 `dsh.profile.bundles` 里。若它被摘掉，
> 需要先 `dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center`。

---

## 1. 安装

在解压后的目录里打开 PowerShell。

### 1.1 先干跑一遍（推荐）

不写任何文件，只做完整性检查并预合成人格预设：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun -WithPersona
```

### 1.2 正式安装

```powershell
# 只装皮肤（最常用）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

# 皮肤 + 今汐 Agent 预设
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -WithPersona

# 只装人格预设，不装皮肤
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -PersonaOnly
```

### 参数

| 参数 | 作用 |
| --- | --- |
| `-DshHome <路径>` | 指定 DSH 主目录。省略时取 `$env:DSH_HOME`，再退到 `~\.dsh` |
| `-WithPersona` | 一并安装「今汐」Agent 预设 |
| `-PersonaOnly` | 只装人格预设 |
| `-DryRun` | 只检查，不写文件 |

### 装到哪儿

```
$DSH_HOME\skins\jinhsi-spectro\        ← 皮肤（始终）
$DSH_HOME\.agent-presets\jinhsi\       ← Agent 预设（仅 -WithPersona / -PersonaOnly）
```

`$DSH_HOME\.agent-presets` 是官方 `@deepseek-ai/dsh-agent-presets` 的**发现根**，
新会话即时可见，不需要重启。

### 安装器会做什么 / 不会做什么

**会做**：校验发布包完整性 → 校验 `skin.json` 的 `id` 与 `skinManifestVersion` →
检查目标未被占用 → 复制皮肤 →（可选）合成并校验 Agent 预设 → 写入。

**不会做**：不覆盖已存在的同名皮肤/预设（会停下让你先卸载）、
不写 API Key / 凭据 / `.env`、不改 `cordis.patch.yml`、不装 npm 依赖、
不触碰其他皮肤或预设。出错会**回滚**已创建的内容，不留半安装状态。

---

## 2. 激活

1. **刷新浏览器页面**（F5）。
   皮肤是纯资产目录，皮肤中心在页面加载时重新扫描目录册，**不需要重启 `dsh`**。
   若列表里没出现，把「设置 → 皮肤中心」卡片关掉再打开一次。
2. 打开 **设置 → 皮肤中心**，列表里出现 **「今汐·洄天溯海」**（强调色 `#c9a227`）。
3. 先点 **试穿** 看效果 —— 试穿不落盘，「退出试穿」会完整恢复已提交的皮肤。
4. 满意后点 **应用** —— 原子切换、无需刷新，之后每次打开页面直接以该皮肤启动（无 FOUC）。

### 皮肤中心里的几个滑杆怎么配合

| 控件 | 对本皮肤的作用 |
| --- | --- |
| **背景遮蔽** | 底色与立绘遮罩的不透明度。**0 = 立绘最清晰**，拉高则整体加纱 |
| 背景模糊（空对话 / 有内容） | 背景层背后的高斯模糊，独立于壁纸设置 |
| 输入卡模糊 | 输入框背后的磨砂半径 |
| 气泡不透明度 | 影响支持气泡 alpha 的皮肤 |

> 立绘位置随主题变化：浅色用半身立绘（`jinhsi-pile.webp`），深色用全身立绘
> （`jinhsi-activity.webp`），这是 `skin.json` 里 `backgroundMedia` 的声明。

### 用 Wallpaper Engine 壁纸时

**皮肤已经适配好了，不需要你做任何事。** 挂上壁纸后：

- 皮肤自己的立绘与氛围底会**自动让位**，壁纸完整显示；
- 皮肤改为在壁纸之上加一层**随滑杆变浓的纱幕**，并给消息行补一张半透明的
  「笺纸」卡片，保证正文在任何壁纸下都压得住；
- 金线、龙鳞纹、四角回纹、令尹印保留——壁纸之下这些是皮肤还在场的证据。

**可读性只想调一个地方的话，就调「背景遮蔽」**：

| 滑杆 | 效果 |
| --- | --- |
| 0 | 壁纸最清晰，正文靠「笺纸」卡片托住 |
| 50 | 平衡（默认） |
| 100 | 最实，接近不用壁纸 |

壁纸面板里自带的「压暗」是**另一条独立**的通道，和上面这个滑杆叠加使用。
两个极端都验证过，正文均可读。效果对照图见 `we-adaptation.jpg`。

> 若你发现壁纸「开了但界面还是老样子」，那是皮肤没有让位——
> 本皮肤已修好，机制说明见 [README.md](README.md) 的「Wallpaper Engine 适配」。

### 装上之后你会看到什么变化

除了配色与装饰，皮肤还改了三处**身份**相关的地方（都用官方 slot 出口定位，不碰哈希类名）：

| 位置 | 变化 |
| --- | --- |
| 侧栏左上角 | 灰鲸鱼 → **今汐圆形头像**（金环 + 青玉光晕） |
| 侧栏左上角文字 | `DeepSeek Harness` → **今汐** |
| 每条助手消息 | 左侧多一个圆形今汐头像，消息本身变成一张「来信」卡片 |
| 你自己发的消息 | 青玉色气泡 + 右上小尖角（仿《鸣潮》飞讯的去信样式） |
| 空对话欢迎区 | 品牌标记换成放大的今汐头像 |
| 新对话页抬头 | `探索未至之境 预览版` → **桃夭灼灼牵丝动 漂泊者** |

对照图：`hero.jpg`（新对话页）、`we-adaptation.jpg`（壁纸下）。

头像用的是官方头像图标 `assets/jinhsi-head.webp`，靠 CSS 圆形裁切与取景，
没有额外复制一份美术文件。

想把头像换掉？把那个文件替换成你自己的方图即可（建议 256×256 以上、主体居中偏上）。

### 确认装好了

```powershell
# 文件在不在
Test-Path "$env:USERPROFILE\.dsh\skins\jinhsi-spectro\skin.json"

# 皮肤中心认得它吗
Invoke-WebRequest 'http://127.0.0.1:3080/api/skin-center/v2/active' -UseBasicParsing
```

### 启用今汐人格

1. **设置 → Agent 预设**，选择 **「今汐」**（新建会话时选）。
2. **已在运行的会话保持原预设** —— 会话的组合在创建时固定，需要新建会话才生效。
3. 创意工坊的「预设」面板会把自建预设标注为**「未托管」**。
   这是**预期行为**：该面板只管理带市场 provenance 的预设，
   手工投放的目录它不会禁用也不会卸载，但会如实标注。不影响使用。

---

## 3. 排错

### 皮肤中心列表里没有「今汐·洄天溯海」

按顺序查：

1. **目录在不在**
   ```powershell
   Get-ChildItem "$env:USERPROFILE\.dsh\skins\jinhsi-spectro"
   ```
   应该看到 `skin.json` / `skin.css` / `patches.css` / `assets` / `preview`。

2. **刷新了吗** —— 目录册在页面加载时扫描。关掉卡片再打开，或干脆 F5。

3. **`skin.json` 合法吗** —— 皮肤中心对 manifest 是 **fail-closed**：
   未知字段、缺必填、`id` 不合规都会被排除，并作为目录诊断上报。本地自检：
   ```powershell
   node .\tools\validate-skin.mjs
   ```
   它会用 ajv 跑皮肤中心自带的官方 JSON Schema。

4. **`$DSH_HOME` 用的是哪个** —— 安装器和皮肤中心必须看同一个主目录：
   ```powershell
   Write-Output $env:DSH_HOME
   ```
   为空则默认 `~\.dsh`。皮肤中心还支持 `DSH_SKINS_HOME` / `DSH_SKINS_DIR` 覆盖，
   若设了这两个变量，皮肤要放到它们指向的位置。

5. **皮肤中心本身在不在线** —— 见前面的 `/api/skin-center/v2/active` 检查。

### 皮肤出现了，但立绘/装饰没显示

- **「背景遮蔽」滑杆拉太高了** —— 拉到 0 试试。
- **装饰层没挂载** —— 6 个装饰层由皮肤中心的客户端运行时挂载。
  在浏览器控制台执行，应该返回 6 个元素：
  ```js
  document.querySelectorAll('[data-dsh-skin-layer]').length
  ```
- **看控制台有没有 CSS 被拒** —— 皮肤 CSS 经白名单净化，违规会 fail-closed。
  本包已通过 `lightningcss` 与白名单自检，理论上不会触发。
- **`:has()` 状态投影不生效** —— 那是纯增益。DSH Web GUI 只跑 Chromium，正常都支持。

### 语义层（面板配色）只生效了一部分

皮肤的 L2 语义层依赖 `data-dsh-surface` / `data-dsh-part` 属性，
由皮肤中心的兼容适配器打在官方壳层 DOM 上。官方区域覆盖完整；
**不输出语义属性的第三方插件区域只享受 L1 token 覆盖**——这是契约层面的已知限制，不是本皮肤的缺陷。

### 人格预设装不上

安装器会报 `人格预设合成失败`。原因是找不到 `standard` Agent 预设组合
（`@deepseek-ai/dsh-agent-presets` 未随 DSH 安装）。手工方案见 §5。

### 装了人格预设但「设置 → Agent 预设」里看不到

- 官方设置分区只在自身动作、`settings/document-updated` 与 `connection/reset` 时重读，
  可能需要**刷新页面**；**新建会话会立即看到它**。
- 确认目录名与 `preset.yml`：
  ```powershell
  Get-Content "$env:USERPROFILE\.dsh\.agent-presets\jinhsi\preset.yml"
  ```
- 若 id 与内置或配置根提供的预设重名，自定义的会被静默忽略。

---

## 4. 卸载

```powershell
# 先看会删什么
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -DryRun

# 实际卸载（皮肤 + 预设）
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1

# 只卸一个
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -SkinOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -PersonaOnly
```

卸载器**带安全标记校验**：

- 皮肤目录只有在 `skin.json` 的 `id` 恰好是 `jinhsi-spectro` 时才删除；
- 预设目录只有在 `preset.yml` 的 `name` 恰好是「今汐」时才删除。

标记不匹配就**跳过并报告**，绝不盲删。卸载器幂等，重复运行不报错。
它只删这两个目录，不触碰其他皮肤、预设、凭据或会话数据。

卸载后刷新页面即可回到「官方默认」。**不需要重启 `dsh`。**

---

## 5. 手工安装（不想用脚本时）

### 皮肤

```powershell
$dst = Join-Path $env:USERPROFILE '.dsh\skins\jinhsi-spectro'
New-Item -ItemType Directory -Path $dst -Force
Copy-Item .\skin\* $dst -Recurse -Force
```

然后刷新页面，在 **设置 → 皮肤中心** 试穿/应用。

### 人格预设

预设需要一份 `agent.cordis.yml`。手工做法是复制 `standard` 组合、替换 `persona` 行：

```powershell
# 1) 合成（自动定位 standard 组合）
node .\tools\compose-preset.mjs --out "$env:TEMP\jinhsi-agent.cordis.yml"
```

`compose-preset.mjs` 接受 `--standard <路径>` 显式指定组合文件。
找不到 `standard` 时，用 `--check` 看它找了哪些位置：

```powershell
node .\tools\compose-preset.mjs --check
```

```powershell
# 2) 落到发现根
$dst = Join-Path $env:USERPROFILE '.dsh\.agent-presets\jinhsi'
New-Item -ItemType Directory -Path $dst -Force
Copy-Item "$env:TEMP\jinhsi-agent.cordis.yml" $dst
Copy-Item .\persona\preset\preset.yml $dst
```

**只想改人格、不想动组合**：把 `persona/system-prompt.txt` 的内容填进任意 preset 的
`persona` 行的 `config.prefix` 即可（用 YAML 字面块 `|-`，逐行比 `prefix:` 多缩进两格）。

### 只用提示词、不装预设

`persona/system-prompt.txt` 是独立纯文本，可以直接贴到任何支持自定义系统提示的地方。

---

## 6. 开发与再生成

```powershell
# 皮肤自检（改完 CSS 一定要跑）
node .\tools\validate-skin.mjs

# 重新生成预览图（会顺带做一次真实浏览器渲染自检）
node .\tools\make-preview.mjs

# 重新抓取语料
node .\tools\extract-jinhsi.mjs --refresh

# 单独预览：直接用浏览器打开，?theme=dark 切深色
start .\tools\preview-mock.html
```

改 CSS 之后的工作流：改 `skin/skin.css` 或 `skin/patches.css`
→ `node tools/validate-skin.mjs` → `node tools/make-preview.mjs` → 看图。

`validate-skin.mjs` 会因为 `preview/*.jpg` 被 `make-preview.mjs` 重写而变化，
这是正常的；重跑一次自检即可。

---

## 7. 回退与恢复

按影响从小到大：

| 情况 | 做法 |
| --- | --- |
| 只想换回默认外观 | 皮肤中心点 **「官方默认」**（无需卸载） |
| 想彻底移除 | `uninstall.ps1`，然后刷新页面 |
| 卸载器报「安全标记不匹配」 | 说明那个目录不是本包装的，**不要手工删**——先确认它是谁的 |
| 皮肤中心整个被停用 | 皮肤目录会静置不生效，外观自动回退；不需要清理 |
| 预设装坏了 | 删 `$DSH_HOME\.agent-presets\jinhsi\` 整个目录即可，不影响其他预设 |

本包**不写** `cordis.patch.yml`，**不改** profile 的 `package.json`，
所以不存在「卸载后启动不起来」的路径。

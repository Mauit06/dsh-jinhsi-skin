# 今汐·洄天溯海

[English](README.md) | **简体中文**

面向 **DeepSeek Harness** Web GUI 的《鸣潮》**今汐**主题：银白、墨黑、金线、薄荷青，
边框走潮汐回纹与龙鳞纹，侧栏品牌与每条助手消息换成今汐头像，对话界面仿游戏里的**飞讯**。
背景是随主题分发的**动态壁纸「今汐——安静」**——1920×1080 循环动画，
亮暗两套共用同一张底图，只用遮罩与滤镜分别适配。

这是一个**皮肤插件**：装上它，皮肤就进了 `$DSH_HOME/skins/jinhsi-spectro/`。

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="浅色主题">
  <img src="skin/preview/dark.jpg" width="49%" alt="深色主题">
</p>

**要求** — DSH ≥ `0.1.5-rc.1` · Node.js ≥ 22 · 一个渲染器（**皮肤中心**，可选但基本必备）
· Chromium 内核浏览器（DSH Web GUI 本身只跑 Chromium）。

---

## 安装

```powershell
dsh plugin --profile web add github:Mauit06/dsh-jinhsi-skin
```

新增插件包需要**重启一次 DSH**。

### 可选：皮肤中心（渲染器 + 壁纸）

皮肤是纯声明式资产目录，需要有**渲染器**才会显示。本插件把皮肤中心
`@linxin666/dsh-client-ui-skin-center` 声明为 **optional peer dependency**——装不装由你决定：

```powershell
# DSH >= 0.1.7-rc.1 —— 装最新版皮肤中心
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center

# DSH 0.1.5-rc.x —— 锁 0.3.24（0.3.25 起要求 DSH >= 0.1.7-rc.1）
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center@0.3.24
```

- **装上它**：多出「设置 → 皮肤中心」，可以试穿 / 应用皮肤、拖背景遮蔽滑杆，
  并**使用壁纸**——Wallpaper Engine 桥（视频 / web / 场景壁纸三种都能渲染，
  也可以钉一张静态帧），或把任意 `.mp4` / `.webm`、单个壁纸项目文件夹、
  项目合集加进「手动文件夹」当成壁纸库。
- **不装它**：皮肤照常同步到皮肤目录，静置等待渲染器；profile 里若已经有
  别的皮肤中心，也就不必再装。

### 卸载

```powershell
dsh plugin --profile web remove dsh-jinhsi-skin
```

## 兼容性

| 宿主 DSH | 皮肤中心 | 皮肤契约 | 状态 |
| --- | --- | --- | --- |
| ≥ 0.1.5-rc.1 | 0.3.23 / 0.3.24 | v2 | 支持（本仓库验证：0.1.5-rc.2 + 0.3.24） |
| ≥ 0.1.7-rc.1 | 0.3.25 … 0.4.x | v2 | 支持（本仓库验证：**0.1.7-rc.2 + 0.4.2**） |
| 0.1.5-rc.x | ≥ 0.3.25 | v2 | **不要这样装**：皮肤中心要求 DSH ≥ 0.1.7-rc.1 |

- 皮肤中心 **0.3.25** 起要求宿主 `>= 0.1.7-rc.1`，**0.4.0** 又抬了一个大版本。
  所以 DSH `0.1.5-rc.x` 上请锁 `@0.3.24`——它是最后一版声明 `>= 0.1.5-rc.1` 的。
- loader 只把 `dsh.engines` 当提示、**不做硬校验**：新版皮肤中心装到老宿主上
  不会启动即报错，只会在运行时表现异常。版本要自己钉，别指望 fail-loud。
- 本插件的 peer 范围是 `^0.3.23 || ^0.4.0`，新旧两个大版本都覆盖；皮肤中心再抬一个
  大版本（`0.5`）时需要跟着放宽。

> 一个 profile 里只应有一个皮肤中心实例。别处已经挂了皮肤中心（例如
> `@linxin666/dsh-web-all` 里的 `web-ui-skin-center`）时，把其中一份关掉：两份同时活着
> 会重复注册 `/api/skin-center/*` 路由、并重复挂载皮肤控制器。

完整的版本矩阵与逐项验证记录见 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)。

## 有什么

- 浅色 / 深色双主题，配色从角色立绘**取样**而来；背景是内置的动态壁纸（亮暗共用一张底图）
- 六个固定装饰层，皮肤本体**全部用 CSS 填充**，没有一行自己的客户端 JavaScript
- 侧栏品牌与每条助手消息都带今汐头像；新对话页抬头变成「桃夭灼灼牵丝动 漂泊者」
- 飞讯式对话：助手侧「来信」卡片，用户侧青玉气泡带尖角
- 状态投影也是纯 CSS（`:has()` 读官方壳层已有属性）：流式中顶线走金、工具调用转薄荷青、出错转朱砂

## 壁纸与背景

皮肤中心的卡片里就是全部开关：

- **背景遮蔽滑杆（0–100%）**——本皮肤所有半透底色都乘 `var(--dsw-skin-scrim)`，
  所以这个滑杆是真旋钮：拉到 0 时底图最清晰，正文靠「笺纸」卡片托住；拉满则接近实底。
- **背景模糊 / 输入卡模糊 / 气泡不透明度**——分别作用于空对话、有内容、输入卡与消息气泡。
- **壁纸面板**——把本机 Wallpaper Engine 库（Steam 应用 431960）当 GUI 背景用。

皮肤对壁纸是**主动让位**的，而且**壁纸永远优先于内置底图**：壁纸挂载时
（`body[data-dsh-wallpaper-active]`）背景层由「底」改「纱」、环境层收起衍射光晕、
前景层加强暗角、消息行补一层「笺纸」，金线 / 龙鳞纹 / 四角回纹 / 令尹印照旧——
壁纸之下，这些才是皮肤还在场的证据。想回到内置的动态壁纸，在壁纸面板点「移除」。

## 美术与授权

**头像**（`skin/assets/jinhsi-head.webp`）版权归**库洛游戏**所有，仓库里**没有**：
`skin/assets/*.webp` 与 `*.jpg` 已被 git 忽略，由插件在安装时于**你的机器上**从库洛
官方站点 / 资源 CDN 取回（来源、角色说明与 sha256 锚点见
[`tools/asset-sources.json`](tools/asset-sources.json)）。

**背景动态壁纸**（`skin/assets/jinhsi-quiet.mp4`，1920×1080 / 8 秒 / H.264）是个例外：
它**随包分发**。壁纸只有本机导出件、没有可下载的官方地址，不带它别的机器装上皮肤
就没有底图。它取自 Wallpaper Engine 创意工坊 item `3606711102`「今汐——安静」——
画面是《鸣潮》官方今汐美术（© 库洛游戏），场景工程归壁纸原作者。出处与完整权利声明见
[NOTICE](NOTICE)。

仓库里提交的 `skin/preview/*.jpg` 就是用这张真实底图渲染的实际效果；
需要「不含版权素材」的版本时跑 `node tools/make-preview.mjs --placeholder` 覆盖生成。

## 自检

```powershell
node tools/verify-standalone.mjs   # 插件契约（离线，不联网）
node tools/validate-skin.mjs       # 皮肤本体（官方 JSON Schema + lightningcss + 对比度）
```

`verify-standalone` 检查：patch 只挂皮肤同步、**不引用可选依赖**（包没装时那一行会
解析不到，dsh 启动是 fail-loud 的）；皮肤中心确实声明为 optional peer；`skin.json`
引用的文件齐全；同步幂等、不会抹掉本机已取回的官方美术、sha256 对不上时会重新获取
（取不到也只告警，不会把已有文件删空）。全程在临时 `DSH_SKINS_HOME` 里跑，不联网。

## 仓库结构

```
jinhsi-spectro/
├─ skin/                  ★ 皮肤本体（v2 契约的纯资产目录）
│  ├─ skin.json           清单（fail-closed 校验）
│  ├─ skin.css            L1 token 重映射 + L2 语义层
│  ├─ patches.css         L3 装饰层 · 状态投影 · 壁纸适配 · 身份层
│  ├─ assets/             内置动态壁纸 + 自绘纹样（头像于安装时取回）
│  └─ preview/            light.jpg / dark.jpg
├─ lib/index.js           插件 host 半区：把 skin/ 同步进 $DSH_HOME/skins/
├─ cordis.patch.yml       只挂这一行（不引用可选依赖）
├─ corpus/                今汐语料（9 份 Markdown + 原始 JSON）
├─ tools/                 取回 / 校验 / 预览 / 发布脚本
├─ docs/                  兼容矩阵 + 实现说明
├─ NOTICE · LICENSE       权利声明与许可
└─ package.json
```

## 说明

- 建立在皮肤中心的 **v2 皮肤契约**之上；锚点用官方 `data-slot` 出口与
  `data-dsh-surface` / `data-dsh-part` 语义属性，不依赖 CSS-Modules 哈希类名。
- 契约合规情况与唯一一处如实披露的偏差见
  [docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md)（中文）。

**常见问题**

- *背景不是我想要的那张* —— 壁纸（Wallpaper Engine / 手动媒体）**永远优先**；
  在壁纸面板点「移除」就回到内置的动态壁纸。
- *缩略图还是旧的* —— 插件有意保留本机已生成的预览，升级不会覆盖。删掉
  `$DSH_HOME/skins/jinhsi-spectro/preview/` 再重启一次 DSH，就会换回包内的新预览。
- *列表里找不到皮肤* —— 需要渲染器（皮肤中心）；装完记得重启 DSH。

## 致谢

- **库洛游戏（Kuro Games）**——《鸣潮》与今汐，以及本主题使用的官方插画与头像
  （取自 [《鸣潮》官方网站](https://wutheringwaves.kurogames.com/zh-tw/main/news)
  与游戏内官方资源；头像仅在本机取回，动态壁纸的画面版权亦归库洛，
  随主题分发的说明见 [NOTICE](NOTICE)）。
- **[@linxin666/dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web)**
  （作者 zhu1090093659 / linxin666，Apache-2.0）——皮肤中心：v2 皮肤契约、六个装饰层、
  语义属性盖章、遮蔽与模糊滑杆，以及 Wallpaper Engine 桥与壁纸面板。没有它，
  纯声明式的第三方皮肤与壁纸都无从谈起。
- **DeepSeek Harness**——本主题所面向的宿主。
- **wuther.in**——语料来源，也是角色头像的来源站点。
- **dsh-deep-whale / maid-atelier**（作者 Small-tailqwq）——皮肤目录布局与
  打包成 dsh bundle 的参照。
- **[Mornye Observation Skin](https://github.com/is-limo/Mornye-Observation-Skin)**
  （作者 is-limo）——「分层观测工作台」的设计思路来源；该仓库为 UNLICENSED，
  本主题未复制其任何代码或资源，状态投影改用纯 CSS 的 `:has()` 独立实现。
- **蓝色幻想（blue-fantasy）**——皮肤中心的内置皮肤，是本主题 `--dsw-skin-scrim`
  联动与装饰层用法的参照。
- **Wallpaper Engine** 及其创意工坊内容归其作者与各壁纸原作者所有。本主题内置的
  动态壁纸「今汐——安静」是创意工坊 item 3606711102 的导出件，版权归其原作者与
  库洛游戏，仅作本主题的背景随主题分发；此外还有一段让位与可读性适配的 CSS。

非官方粉丝作品，与上述各方均无隶属或背书关系。

代码、样式表、脚本、文档与自绘矢量纹样采用 [MIT](LICENSE) 许可；
官方美术不在该许可覆盖范围内。

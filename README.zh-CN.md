# 今汐·洄天溯海

[English](README.md) | **简体中文**

面向 **DeepSeek Harness** Web GUI 的《鸣潮》**今汐**主题——银白、墨黑、金线、薄荷青，
边框是潮汐回纹与龙鳞纹，侧栏品牌与助手消息是今汐头像，对话界面仿游戏里的**飞讯**。
背景用**库洛官方的今汐插画**（亮色：官方桌布分享《雲青青兮欲雨，水澹澹兮生煙》；
深色：「寒盡覺春生」角色活動喚取主视觉）。

这是一个**皮肤插件**：装上它，皮肤就进了 `$DSH_HOME/skins/jinhsi-spectro/`。

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="浅色主题">
  <img src="skin/preview/dark.jpg" width="49%" alt="深色主题">
</p>

## 安装

```powershell
dsh plugin --profile web add github:Mauit06/dsh-jinhsi-skin
```

新增插件包需要**重启一次 DSH**。

### 可选：皮肤中心（渲染器 + 壁纸）

皮肤是纯声明式资产目录，需要有**渲染器**才会显示。本插件把皮肤中心
`@linxin666/dsh-client-ui-skin-center` 声明为 **optional peer dependency**——
装不装由你决定：

```powershell
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center
```

- **装上它**：多出「设置 → 皮肤中心」，可以试穿 / 应用皮肤、拖背景遮蔽滑杆，
  并**使用壁纸**——Wallpaper Engine 桥（视频 / web / 场景壁纸三种都能渲染，
  也可以钉一张静态帧）或者把任意 `.mp4` / `.webm`、单个壁纸项目文件夹、
  项目合集文件夹加进「手动文件夹」当成壁纸库。
- **不装它**：皮肤照常同步到皮肤目录，静置等待渲染器；如果你 profile 里已经有
  别的皮肤中心，也就不必再装。

> 一个 profile 里只应有一个皮肤中心实例。如果已经有别处挂了皮肤中心
> （例如 `@linxin666/dsh-web-all` 里的 `web-ui-skin-center`），把其中一份关掉：
> 两份同时活着会重复注册 `/api/skin-center/*` 路由、并重复挂载皮肤控制器。

卸载：

```powershell
dsh plugin --profile web remove dsh-jinhsi-skin
```

需要 DSH ≥ `0.1.5-rc.1` 与 Node.js 22+。

## 壁纸与背景

皮肤中心的卡片里就是全部开关：

- **背景遮蔽滑杆（0–100%）**——本皮肤所有半透底色都乘 `var(--dsw-skin-scrim)`，
  所以这个滑杆是真旋钮：拉到 0 时插画最清晰，正文靠「笺纸」卡片托住；拉满则接近实底。
- **背景模糊 / 输入卡模糊 / 气泡不透明度**——分别作用于空对话、有内容、
  输入卡与消息气泡。
- **壁纸面板**——把本机 Wallpaper Engine 库（Steam 应用 431960）当 GUI 背景用。

皮肤对壁纸是**主动让位**的：壁纸挂载时（`body[data-dsh-wallpaper-active]`）背景层由
「底」改「纱」、环境层收起衍射光晕、前景层加强暗角、消息行补一层「笺纸」，
金线 / 龙鳞纹 / 四角回纹 / 令尹印照旧——壁纸之下，这些才是皮肤还在场的证据。

## 自检

```powershell
node tools/verify-standalone.mjs
```

离线检查这个插件的契约：patch 只挂皮肤同步、**不引用可选依赖**（包没装时那一行会
解析不到，dsh 启动是 fail-loud 的）；皮肤中心确实声明为 optional peer；`skin.json`
引用的文件齐全；同步幂等、不会抹掉本机已取回的官方美术、sha256 对不上时会重新获取
（取不到也只告警，不会把已有文件删空）。全程在临时 `DSH_SKINS_HOME` 里跑，不联网。

## 官方美术不随仓库分发

角色与插画版权归**库洛游戏**所有。仓库里**没有**这些文件：`skin/assets/*.webp`
与 `*.jpg` 已被 git 忽略，由插件在安装时于**你的机器上**从库洛官方站点 / 资源 CDN
取回（来源、角色说明与 sha256 锚点见 [`tools/asset-sources.json`](tools/asset-sources.json)）。
上面两张预览图是「占位版」（`tools/make-preview.mjs --placeholder`）：结构与配色真实，
但立绘与头像位置用的是本项目自绘的令尹印，不含官方素材；装到本机后可以用
`node tools/make-preview.mjs --out-dir <皮肤目录>/preview` 生成含官方美术的真实预览。
完整权利声明见 [NOTICE](NOTICE)。

## 有什么

- 浅色 / 深色双主题，配色从角色立绘**取样**而来；背景是库洛官方的今汐插画
- 六个固定装饰层，皮肤本体**全部用 CSS 填充**，没有一行自己的客户端 JavaScript
- 侧栏品牌与每条助手消息都带今汐头像；新对话页抬头变成「桃夭灼灼牵丝动 漂泊者」
- 飞讯式对话：助手侧「来信」卡片，用户侧青玉气泡带尖角
- 状态投影也是纯 CSS（`:has()` 读官方壳层已有属性）：流式中顶线走金、工具调用转薄荷青、出错转朱砂
- 壁纸（Wallpaper Engine / 手动媒体）随可选的皮肤中心一起来，见上文

## 说明

- 建立在皮肤中心的 **v2 皮肤契约**之上；锚点用官方 `data-slot` 出口与
  `data-dsh-surface` / `data-dsh-part` 语义属性，不依赖 CSS-Modules 哈希类名。
- 契约合规情况与唯一一处如实披露的偏差见 [docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md)。

## 致谢

- **库洛游戏（Kuro Games）**——《鸣潮》与今汐，以及本主题使用的官方插画与头像
  （取自 [《鸣潮》官方网站](https://wutheringwaves.kurogames.com/zh-tw/main/news) 的
  官方桌布分享与角色档案，仅在本机取回、不再分发）。
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
- **Wallpaper Engine** 及其创意工坊内容归其作者与各壁纸原作者所有；本主题不包含
  任何壁纸文件，只有一段让位与可读性适配的 CSS。

非官方粉丝作品，与上述各方均无隶属或背书关系。

代码、样式表、脚本、文档与自绘矢量纹样采用 [MIT](LICENSE) 许可；
官方美术不在该许可覆盖范围内。

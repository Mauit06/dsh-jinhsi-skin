# 今汐·洄天溯海

[English](README.md) | **简体中文**

面向 **DeepSeek Harness** Web GUI 的《鸣潮》**今汐**主题——银白、墨黑、金线、薄荷青，
边框是潮汐回纹与龙鳞纹，侧栏是今汐头像，对话界面仿游戏里的**飞讯**。

纯声明式皮肤：不含可执行客户端代码，无遥测，运行时不联网。

<p align="center">
  <img src="skin/preview/light.jpg" width="49%" alt="浅色主题">
  <img src="skin/preview/dark.jpg" width="49%" alt="深色主题">
</p>

## 安装

```powershell
dsh plugin --profile web add github:Mauit06/dsh-jinhsi-skin
```

新增插件包需要**重启一次 DSH**，然后打开
**设置 → 皮肤中心 → 「今汐·洄天溯海」→ 试穿 / 应用**。

卸载：

```powershell
dsh plugin --profile web remove dsh-jinhsi-skin
```

这个包只做一件事：把皮肤放进皮肤中心的用户皮肤目录
（`$DSH_HOME/skins/jinhsi-spectro/`）——皮肤中心只从那里发现皮肤。
需要 DSH ≥ `0.1.5-rc.1` 与皮肤中心，以及 Node.js 22+。

<details>
<summary>手工安装（不用插件）</summary>

把 `skin/` 复制到 `$DSH_HOME/skins/jinhsi-spectro/`，然后在克隆目录里运行
`node tools/fetch-assets.mjs` 获取官方美术，刷新页面即可。

</details>

## ⚠️ 不含官方美术

角色美术版权归**库洛游戏**所有。本仓库不分发任何一份：`skin/assets/*.webp` 已被 git 忽略，
由插件在安装时于**你的机器上**下载。上面两张预览图是占位版，立绘与头像位置用的是
本项目自绘的令尹印。完整权利声明见 [NOTICE](NOTICE)。

## 有什么

- 浅色 / 深色双主题，配色从角色立绘**取样**而来，不是凭印象调的
- 六个固定装饰层，**全部用 CSS 填充**，没有一行客户端 JavaScript
- 侧栏品牌与每条助手消息都带今汐头像；新对话页抬头变成「桃夭灼灼牵丝动 漂泊者」
- 飞讯式对话：助手侧「来信」卡片，用户侧青玉气泡带尖角
- **适配 Wallpaper Engine**——壁纸挂载时皮肤主动让位并保住正文可读性，
  一个旋钮（背景遮蔽滑杆）即可调节
- 可选的**今汐人格预设**在 `persona/`，安装方式见该目录说明；它只替换 `standard` 的
  `persona` 行，工具一个不少
- `corpus/`——今汐全部文本：5 篇故事、75 条语音、17 个技能、6 段共鸣链、2 套服饰

## 说明

- 建立在皮肤中心的 **v2 皮肤契约**之上；锚点用官方 `data-slot` 出口，不依赖 CSS-Modules 哈希类名。
- `node tools/validate-skin.mjs` 会检查 schema、CSS 白名单、选择器作用域、token 名与对比度。
  契约合规情况与唯一一处如实披露的偏差见 [docs/IMPLEMENTATION.zh-CN.md](docs/IMPLEMENTATION.zh-CN.md)。

## 致谢

库洛游戏（《鸣潮》、今汐）·
[dsh-client-ui-skin-center](https://github.com/zhu1090093659/dsh-web)（本皮肤所依赖的 v2 契约）·
DeepSeek Harness · wuther.in（语料来源）· dsh-deep-whale / maid-atelier（布局与打包参照）·
[Mornye Observation Skin](https://github.com/is-limo/Mornye-Observation-Skin)
（仅设计思路来源——该仓库为 UNLICENSED，未复制任何代码或资源）。

非官方粉丝作品，与上述各方均无隶属或背书关系。

代码、样式表、脚本、文档与自绘矢量纹样采用 [MIT](LICENSE) 许可。

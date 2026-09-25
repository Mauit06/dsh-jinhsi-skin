# 兼容性 / Compatibility

本页记录「皮肤插件 ↔ 宿主 DSH ↔ 皮肤中心」三者对得上的版本组合，以及一处必须自己钉住的
版本边界。

This page records the working version combinations and the one version boundary you must pin yourself.

---

## 版本矩阵

| 宿主 DSH | 皮肤中心 @linxin666/dsh-client-ui-skin-center | 皮肤 skinManifestVersion | 状态 |
| --- | --- | --- | --- |
| >= 0.1.5-rc.1 | 0.3.23 / 0.3.24 | 2 | 支持（本仓库验证：0.1.5-rc.2 + 0.3.24） |
| >= 0.1.7-rc.1 | 0.3.25 … 0.4.x | 2 | 支持（皮肤中心自身要求，未在本机验证） |
| 0.1.5-rc.x | >= 0.3.25 | 2 | **不要这样装**：皮肤中心要求 dsh >= 0.1.7-rc.1 |

## 必须钉住的那一条

皮肤中心 **0.3.25 起**在 package.json 里声明：

~~~json
"peerDependencies": { "@deepseek-ai/dsh": ">=0.1.7-rc.1" },
"dsh": { "engines": { "dsh": ">=0.1.7-rc.1" } }
~~~

而 **0.3.24** 是最后一版声明 >= 0.1.5-rc.1 的。所以：

~~~powershell
# DSH >= 0.1.7-rc.1
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center

# DSH 0.1.5-rc.x —— 锁 0.3.24
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center@0.3.24
~~~

本插件的 peer 范围是 ^0.3.23（即 >=0.3.23 <0.4.0），**同时覆盖两者**——同一个范围在新老宿主上
都成立，所以版本选择只能由安装者按宿主 DSH 决定，插件无法用一条 semver 表达。

> DSH 0.1.5-rc.2 的 loader **不硬校验** dsh.engines（dsh-app-boot 与 dsh-package-manifest
> 都不读这个字段）。因此把新版皮肤中心装到老宿主上**不会**启动即报错，只会运行时表现异常。
> 版本要自己钉，别指望 fail-loud。

## 本机验证结论（DSH 0.1.5-rc.2 + 皮肤中心 0.3.24）

- dsh web 以新增 bundle 启动，无解析 / 挂载错误。
- GET /api/skin-center/v2/catalog 收录 jinhsi-spectro，origin 为 user，warnings 为空。
- GET /api/skin-center/v2/skins/jinhsi-spectro/stylesheet 与 patches，以及 assets/*、preview/*
  全部 200（stylesheet / patches 过皮肤中心的 CSS 安全管线）。
- 无头 Edge 打开带 token 的 GUI：html[data-dsh-skin="jinhsi-spectro"]，6 个
  [data-dsh-skin-layer]，--dsw-alias-brand-primary 等 token 已被皮肤重映射，控制台 0 错误。
- node tools/validate-skin.mjs：官方 JSON Schema 通过、lightningcss 解析通过、对比度全达标。
- node tools/verify-standalone.mjs：插件契约自检全部通过。

## 其他环境

- Windows PowerShell 5.1+ / PowerShell 7
- Node.js 22+（仅人格预设合成与工具脚本需要；只装皮肤不需要）
- 状态投影用 :has()，需要 Chromium（DSH Web GUI 只跑 Chromium，安全）

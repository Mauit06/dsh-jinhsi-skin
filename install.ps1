[CmdletBinding()]
param(
  # DSH 主目录。省略时依次取 -DshHome 参数、$env:DSH_HOME、~\.dsh
  [string]$DshHome,

  # 一并安装「今汐」Agent 预设（会改动 $DshHome\.agent-presets\jinhsi）
  [switch]$WithPersona,

  # 只装人格预设，不装皮肤
  [switch]$PersonaOnly,

  # 只做检查，不写任何文件
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SkinId        = 'jinhsi-spectro'
$SkinName      = '今汐·洄天溯海'
$PresetId      = 'jinhsi'
$ReleaseVersion = '1.0.0'

# ───────────────────────────────────────────────────────── 路径解析

function Resolve-DshHome([string]$Requested) {
  if (-not [string]::IsNullOrWhiteSpace($Requested)) {
    return [System.IO.Path]::GetFullPath($Requested)
  }
  if (-not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    return [System.IO.Path]::GetFullPath($env:DSH_HOME)
  }
  return Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh'
}

$Root = $PSScriptRoot
$SourceSkin = Join-Path $Root 'skin'

$DshHome = Resolve-DshHome $DshHome
$SkinsRoot = Join-Path $DshHome 'skins'
$InstalledSkin = Join-Path $SkinsRoot $SkinId
$PresetsRoot = Join-Path $DshHome '.agent-presets'
$InstalledPreset = Join-Path $PresetsRoot $PresetId

Write-Host ''
Write-Host "今汐主题 $ReleaseVersion" -ForegroundColor Cyan
Write-Host "  DSH 主目录   : $DshHome"
Write-Host "  皮肤目标     : $InstalledSkin"
if ($WithPersona -or $PersonaOnly) {
  Write-Host "  预设目标     : $InstalledPreset"
}
if ($DryRun) { Write-Host '  模式         : 只检查，不写入' -ForegroundColor Yellow }
Write-Host ''

# ───────────────────────────────────────────────────────── 发布包完整性

# 随仓库分发的文件：缺任何一个都说明发布包不完整，直接拒绝。
$required = @(
  'skin.json', 'skin.css', 'patches.css',
  'preview\light.jpg', 'preview\dark.jpg',
  'assets\crest.svg', 'assets\scales.svg', 'assets\tide.svg',
  'assets\seal.svg', 'assets\feather.svg'
)
$missing = @()
foreach ($rel in $required) {
  $p = Join-Path $SourceSkin $rel
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { $missing += "skin\$rel" }
}
if ($missing.Count -gt 0) {
  throw ("发布包不完整，缺少：`n  - " + ($missing -join "`n  - "))
}
Write-Host '✓ 发布包完整性检查通过' -ForegroundColor Green

# ─────────────────────────────────────────────────── 官方美术：本机获取
#
# 这些立绘与头像版权归库洛游戏，**不随本仓库分发**（见 NOTICE）。
# 缺什么补什么，来源与 sha256 锚点在 tools/asset-sources.json。

$requiredAssets = @('jinhsi-pile.webp', 'jinhsi-activity.webp', 'jinhsi-head.webp')
$missingAssets = @()
foreach ($a in $requiredAssets) {
  if (-not (Test-Path -LiteralPath (Join-Path $SourceSkin "assets\$a") -PathType Leaf)) { $missingAssets += $a }
}

if ($missingAssets.Count -gt 0) {
  Write-Host ''
  Write-Host "缺少 $($missingAssets.Count) 个官方美术文件。" -ForegroundColor Yellow

  if ($DryRun) {
    # 干跑不产生任何副作用：只报告，不下载。
    Write-Host '  只检查模式：不下载。去掉 -DryRun 后会自动从 wuther.in 获取。' -ForegroundColor DarkGray
    foreach ($a in $missingAssets) { Write-Host "    - $a" -ForegroundColor DarkGray }
    $assetsFetchedNow = $false
  } else {
    Write-Host '尝试在本机获取…（版权归库洛游戏，不随仓库分发，仅在本机下载使用）' -ForegroundColor DarkGray
    $assetsFetchedNow = $true

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $nodeCmd) {
      throw @"
未在 PATH 中找到 node，无法自动获取官方美术。
请二选一：
  1) 安装 Node.js 22+ 后重跑本脚本；
  2) 手动把下列文件放到 $(Join-Path $SourceSkin 'assets')（文件名必须一致）：
$(($missingAssets | ForEach-Object { "       - $_" }) -join "`n")
"@
    }

    & node (Join-Path $Root 'tools\fetch-assets.mjs')
    if ($LASTEXITCODE -ne 0) {
      throw "官方美术获取失败（node 退出码 $LASTEXITCODE）。详见上方输出；也可按提示手动放置文件。"
    }

    $stillMissing = @()
    foreach ($a in $requiredAssets) {
      if (-not (Test-Path -LiteralPath (Join-Path $SourceSkin "assets\$a") -PathType Leaf)) { $stillMissing += $a }
    }
    if ($stillMissing.Count -gt 0) {
      throw ("获取后仍缺少：" + ($stillMissing -join ', '))
    }
    Write-Host '✓ 官方美术已就绪' -ForegroundColor Green
  }
} else {
  $assetsFetchedNow = $false
  Write-Host '✓ 官方美术已就绪' -ForegroundColor Green
}

# 预览图重生成放在「复制到安装目录之后」——见下方安装段落。
# 这里只记录素材是否是本次获取的，用于决定要不要重生成。

# ───────────────────────────────────────────────────────── manifest 安全标记

$manifestPath = Join-Path $SourceSkin 'skin.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.id -ne $SkinId) {
  throw "skin.json 的 id 是 '$($manifest.id)'，期望 '$SkinId'。拒绝安装。"
}
if ($manifest.skinManifestVersion -ne 2) {
  throw "skin.json 的 skinManifestVersion 是 '$($manifest.skinManifestVersion)'，期望 2。拒绝安装。"
}
Write-Host "✓ manifest 校验通过（$($manifest.name) v$($manifest.version)）" -ForegroundColor Green

# ───────────────────────────────────────────────────────── 目标占用检查

$conflicts = @()
if (-not $PersonaOnly -and (Test-Path -LiteralPath $InstalledSkin)) { $conflicts += $InstalledSkin }
if (($WithPersona -or $PersonaOnly) -and (Test-Path -LiteralPath $InstalledPreset)) { $conflicts += $InstalledPreset }
if ($conflicts.Count -gt 0) {
  Write-Host ''
  Write-Host '以下目标已存在，本安装器不覆盖：' -ForegroundColor Yellow
  foreach ($c in $conflicts) { Write-Host "  - $c" }
  Write-Host ''
  Write-Host '请先运行 uninstall.ps1 移除，再安装本版本。'
  exit 1
}

# ───────────────────────────────────────────────────────── 人格预设预合成

$personaStage = $null
if ($WithPersona -or $PersonaOnly) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) {
    throw '未在 PATH 中找到 node。人格预设的合成需要 Node.js 22+；若只想装皮肤，请去掉 -WithPersona。'
  }
  $compose = Join-Path $Root 'tools\compose-preset.mjs'
  if (-not (Test-Path -LiteralPath $compose -PathType Leaf)) {
    throw "缺少合成脚本：$compose"
  }
  $presetSrc = Join-Path $Root 'persona\preset\preset.yml'
  if (-not (Test-Path -LiteralPath $presetSrc -PathType Leaf)) {
    throw "缺少预设元数据：$presetSrc"
  }

  # 先在临时目录合成并校验，全部通过后才落盘——避免留下半安装状态。
  $personaStage = Join-Path ([System.IO.Path]::GetTempPath()) ("jinhsi-preset-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $personaStage -Force | Out-Null

  $stageFile = Join-Path $personaStage 'agent.cordis.yml'
  Write-Host ''
  Write-Host '合成人格预设…'
  # compose-preset.mjs 按 DSH_HOME 定位 standard 组合；用 -DshHome 指定了别处时，
  # 必须把同一个值传给子进程，否则它会去默认主目录找。
  $previousDshHome = [Environment]::GetEnvironmentVariable('DSH_HOME', 'Process')
  try {
    [Environment]::SetEnvironmentVariable('DSH_HOME', $DshHome, 'Process')
    & node $compose --out $stageFile
    $composeExit = $LASTEXITCODE
  } finally {
    [Environment]::SetEnvironmentVariable('DSH_HOME', $previousDshHome, 'Process')
  }
  if ($composeExit -ne 0) {
    Remove-Item -LiteralPath $personaStage -Recurse -Force -ErrorAction SilentlyContinue
    throw "人格预设合成失败（node 退出码 $composeExit）。standard 组合可能不存在，见 INSTALL.md 的手工方案。"
  }
  Copy-Item -LiteralPath $presetSrc -Destination (Join-Path $personaStage 'preset.yml')
  Write-Host '✓ 人格预设已在临时目录合成并校验通过' -ForegroundColor Green
}

if ($DryRun) {
  if ($null -ne $personaStage) { Remove-Item -LiteralPath $personaStage -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Host ''
  Write-Host '只检查模式：未写入任何文件。去掉 -DryRun 即执行安装。' -ForegroundColor Yellow
  exit 0
}

# ───────────────────────────────────────────────────────── 安装

$createdSkin = $false
$createdPreset = $false

try {
  if (-not $PersonaOnly) {
    New-Item -ItemType Directory -Path $SkinsRoot -Force | Out-Null
    Copy-Item -LiteralPath $SourceSkin -Destination $InstalledSkin -Recurse
    $createdSkin = $true
    Write-Host ''
    Write-Host "✓ 皮肤已安装：$InstalledSkin" -ForegroundColor Green

    # 仓库里的 preview 是「不含官方美术」的占位版。这里只给**安装副本**重生成真实预览，
    # 仓库目录保持干净 —— 否则下次 git push 会把含官方美术的预览图提交上去。
    # 无条件尝试（素材此时必定已就位），失败不影响安装，只提示。
    Write-Host '  为安装副本重新生成预览图…' -ForegroundColor DarkGray
    & node (Join-Path $Root 'tools\make-preview.mjs') --out-dir (Join-Path $InstalledSkin 'preview') *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host '  ✓ 安装副本的预览图已按真实素材重新生成' -ForegroundColor Green
    } else {
      Write-Host '  · 预览图重生成跳过（未找到 Edge/Chrome 或渲染失败），继续使用随包的占位预览' -ForegroundColor DarkGray
    }
  }

  if ($WithPersona -or $PersonaOnly) {
    New-Item -ItemType Directory -Path $PresetsRoot -Force | Out-Null
    Copy-Item -LiteralPath $personaStage -Destination $InstalledPreset -Recurse
    $createdPreset = $true
    Write-Host "✓ 人格预设已安装：$InstalledPreset" -ForegroundColor Green
  }
} catch {
  $installError = $_
  Write-Warning '安装过程中出错，正在回滚…'
  if ($createdPreset -and (Test-Path -LiteralPath $InstalledPreset)) {
    Remove-Item -LiteralPath $InstalledPreset -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($createdSkin -and (Test-Path -LiteralPath $InstalledSkin)) {
    Remove-Item -LiteralPath $InstalledSkin -Recurse -Force -ErrorAction SilentlyContinue
  }
  throw $installError
} finally {
  if ($null -ne $personaStage -and (Test-Path -LiteralPath $personaStage)) {
    Remove-Item -LiteralPath $personaStage -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ───────────────────────────────────────────────────────── 后续步骤

Write-Host ''
Write-Host '接下来：' -ForegroundColor Cyan
if (-not $PersonaOnly) {
  Write-Host '  1. 刷新浏览器页面（F5）。皮肤是纯资产目录，注册表会在页面加载时重新扫描，无需重启 dsh。'
  Write-Host '  2. 打开 设置 → 皮肤中心，列表里会出现「今汐·洄天溯海」。'
  Write-Host '  3. 先点「试穿」看效果，满意再点「应用」持久化。'
  Write-Host '  4. 皮肤中心的「背景遮蔽」滑杆可以调节立绘的可见程度。'
}
if ($WithPersona -or $PersonaOnly) {
  Write-Host '  5. 新建会话时在「设置 → Agent 预设」里选择「今汐」。'
  Write-Host '     注意：皮肤中心会把自建预设标注为「未托管」，这是预期行为，不影响使用。'
  Write-Host '     已在运行的会话保持原预设，需要新建会话才会生效。'
}
Write-Host ''
Write-Host '本安装器没有写入任何 API Key、凭据、会话数据或 cordis 接线。' -ForegroundColor DarkGray
Write-Host '皮肤是纯声明式资产目录，不含任何可执行代码。' -ForegroundColor DarkGray
Write-Host ''

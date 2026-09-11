[CmdletBinding()]
param(
  # DSH 主目录。省略时依次取 -DshHome 参数、$env:DSH_HOME、~\.dsh
  [string]$DshHome,

  # 只卸载人格预设，保留皮肤
  [switch]$PersonaOnly,

  # 只卸载皮肤，保留人格预设
  [switch]$SkinOnly,

  # 只显示将要删除的内容，不实际删除
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SkinId   = 'jinhsi-spectro'
$PresetId = 'jinhsi'
$PresetMarkerName = 'preset.yml'
$PresetMarkerNameValue = '今汐'

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

$DshHome = Resolve-DshHome $DshHome
$InstalledSkin = Join-Path (Join-Path $DshHome 'skins') $SkinId
$InstalledPreset = Join-Path (Join-Path $DshHome '.agent-presets') $PresetId

Write-Host ''
Write-Host '今汐主题 · 卸载' -ForegroundColor Cyan
Write-Host "  DSH 主目录 : $DshHome"
Write-Host ''

$doSkin = -not $PersonaOnly
$doPreset = -not $SkinOnly
$removed = 0
$skipped = @()

# ───────────────────────────────────────────────────────── 皮肤

if ($doSkin -and (Test-Path -LiteralPath $InstalledSkin)) {
  # 安全标记：只有在 skin.json 的 id 与预期一致时才删除目录。
  $marker = Join-Path $InstalledSkin 'skin.json'
  $ok = $false
  if (Test-Path -LiteralPath $marker -PathType Leaf) {
    try {
      $m = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
      $ok = ($m.id -eq $SkinId)
    } catch {
      $ok = $false
    }
  }

  if ($ok) {
    if ($DryRun) {
      Write-Host "  将删除皮肤目录：$InstalledSkin" -ForegroundColor Yellow
    } else {
      Remove-Item -LiteralPath $InstalledSkin -Recurse -Force
      Write-Host "✓ 已删除皮肤：$InstalledSkin" -ForegroundColor Green
    }
    $removed++
  } else {
    $skipped += "$InstalledSkin（skin.json 的 id 不是 '$SkinId'，拒绝删除）"
  }
} elseif ($doSkin) {
  Write-Host "  · 皮肤未安装，跳过：$InstalledSkin" -ForegroundColor DarkGray
}

# ───────────────────────────────────────────────────────── 人格预设

if ($doPreset -and (Test-Path -LiteralPath $InstalledPreset)) {
  # 安全标记：preset.yml 必须存在且 name 为「今汐」。
  $marker = Join-Path $InstalledPreset $PresetMarkerName
  $ok = $false
  if (Test-Path -LiteralPath $marker -PathType Leaf) {
    $text = Get-Content -LiteralPath $marker -Raw -Encoding UTF8
    $ok = $text -match ("(?m)^name:\s*" + [regex]::Escape($PresetMarkerNameValue) + "\s*$")
  }

  if ($ok) {
    if ($DryRun) {
      Write-Host "  将删除人格预设目录：$InstalledPreset" -ForegroundColor Yellow
    } else {
      Remove-Item -LiteralPath $InstalledPreset -Recurse -Force
      Write-Host "✓ 已删除人格预设：$InstalledPreset" -ForegroundColor Green
    }
    $removed++
  } else {
    $skipped += "$InstalledPreset（preset.yml 缺失或 name 不是「$PresetMarkerNameValue」，拒绝删除）"
  }
} elseif ($doPreset) {
  Write-Host "  · 人格预设未安装，跳过：$InstalledPreset" -ForegroundColor DarkGray
}

# ───────────────────────────────────────────────────────── 结果

Write-Host ''
if ($skipped.Count -gt 0) {
  Write-Warning '以下目录被跳过（安全标记不匹配）：'
  foreach ($s in $skipped) { Write-Host "  - $s" }
}

if ($removed -eq 0 -and $skipped.Count -eq 0) {
  Write-Host '没有需要卸载的内容。' -ForegroundColor DarkGray
} elseif ($DryRun) {
  Write-Host '只检查模式：未删除任何内容。去掉 -DryRun 即执行卸载。' -ForegroundColor Yellow
} else {
  Write-Host '卸载完成。刷新浏览器页面即可回到「官方默认」外观。' -ForegroundColor Green
  Write-Host '（皮肤中心会自动回退；不需要重启 dsh。）' -ForegroundColor DarkGray
}
Write-Host ''
Write-Host '本卸载器只删除它自己安装的两个目录，不触碰其他皮肤、预设、凭据或会话数据。' -ForegroundColor DarkGray
Write-Host ''

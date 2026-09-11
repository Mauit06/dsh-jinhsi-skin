[CmdletBinding()]
param(
  # 仓库名（默认沿用本主题的仓库名）
  [string]$Repo = 'dsh-jinhsi-skin',

  # 仓库所有者。省略时从 token 对应的账号读取
  [string]$Owner,

  # 提交信息。省略时自动生成
  [string]$Message,

  # 仓库不存在时自动创建
  [switch]$Create,

  # 建成公开仓库（配合 -Create）
  [switch]$Public,

  # 从哪个用户环境变量读取 token
  [string]$TokenVar = 'GH_TOKEN',

  # 只做检查，不提交也不推送
  [switch]$DryRun
)

Set-StrictMode -Version Latest

# 本脚本要频繁调用 git；在 $ErrorActionPreference='Stop' 下，PowerShell 会把原生命令
# 写到 stderr 的普通提示（例如 "fatal: --local ..."）当作终止错误。所以全局用 Continue，
# 只对 HTTP 调用单独加 -ErrorAction Stop。
$ErrorActionPreference = 'Continue'

$Root = $PSScriptRoot

function Fail([string]$m) { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }
function Ok([string]$m)   { Write-Host "✓ $m" -ForegroundColor Green }
function Info([string]$m) { Write-Host "  $m" -ForegroundColor DarkGray }

# ─────────────────────────────────────────────── token：只读用户环境变量
#
# 绝不把 token 写进任何文件、命令行参数或 git 配置的持久字段。
# 只在一次性推送时通过 --git-dir 之外的临时 remote URL 使用，用完整即还原干净 URL。

$tokenVars = @($TokenVar, 'GH_TOKEN', 'GH_WORKFLOW_TOKEN', 'DSH_RESCUE_GH_TOKEN') | Select-Object -Unique
$token = $null
$tokenFrom = $null
foreach ($v in $tokenVars) {
  $val = [Environment]::GetEnvironmentVariable($v, 'User')
  if (-not [string]::IsNullOrWhiteSpace($val)) { $token = $val; $tokenFrom = $v; break }
}
if ($null -eq $token) {
  Fail "未在用户环境变量中找到 GitHub token（找过：$($tokenVars -join ', ')）。`n  设置示例：setx GH_TOKEN ghp_xxx"
}
Info "token 来源：$tokenFrom（长度 $($token.Length)，不打印内容）"

$headers = @{ Authorization = "Bearer $token"; 'User-Agent' = 'dsh-jinhsi-skin'; Accept = 'application/vnd.github+json' }

try {
  $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -TimeoutSec 30 -ErrorAction Stop
} catch {
  Fail "token 无效或网络不可达：$($_.Exception.Message)"
}
if ([string]::IsNullOrWhiteSpace($Owner)) { $Owner = $me.login }
Ok "GitHub 账号：$Owner（token 属主：$($me.login)）"

$Slug = "$Owner/$Repo"
$Remote = "https://github.com/$Slug.git"

# ─────────────────────────────────────────────── 本地仓库

Push-Location $Root
try {
  $hasGit = Test-Path (Join-Path $Root '.git')
  if (-not $hasGit) {
    if ($DryRun) {
      Info '尚未 git init（-DryRun 不执行）'
    } else {
      git init -q
      if ($LASTEXITCODE -ne 0) { Fail 'git init 失败' }
      $hasGit = $true
      Ok 'git 仓库已初始化'
    }
  }
  Info "工作目录：$Root"

  # 提交身份：只在仓库级设置，不动全局配置
  if ($hasGit) {
    $curName = (git config --local user.name) 2>$null
    if ([string]::IsNullOrWhiteSpace($curName)) {
      $identity = "$($me.id)+$($me.login)@users.noreply.github.com"
      if (-not $DryRun) {
        git config --local user.name  $me.login
        git config --local user.email $identity
      }
      Info "提交身份：$($me.login) <$identity>（仓库级）"
    } else {
      Info "提交身份已存在：$curName"
    }
  }

  # 安全闸：确认官方美术没有被暂存
  $tracked = git ls-files --cached 2>$null
  $wouldAdd = git status --porcelain 2>$null

  # ─────────────────────────────────────────────── 暂存与提交

  if ($DryRun) {
    if ($hasGit) {
      Info '将要提交的文件（-DryRun 只预览）：'
      git add -A --dry-run 2>&1 | ForEach-Object { "      $_" }
    } else {
      Info '仓库尚未初始化，无法预览待提交文件；实际运行时会先 git init 再全量加入。'
    }
  } else {
    git add -A
    $staged = git diff --cached --name-only
    if ([string]::IsNullOrWhiteSpace($staged)) {
      Info '没有需要提交的改动'
    } else {
      if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = "Update Jinhsi skin ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
      }
      git commit -q -m $Message
      Ok "已提交：$Message"
    }
  }

  # 断言：任何 .webp / we-adaptation.jpg 都不该在索引里
  $bad = git ls-files --cached | Where-Object { $_ -match '\.webp$' -or $_ -match '^we-adaptation\.jpg$' }
  if ($bad) {
    Fail "版权素材被误加入索引，已中止：`n  - $($bad -join "`n  - ")"
  }
  Ok '索引检查通过：无官方美术、无第三方壁纸'

  if ($DryRun) {
    Info '只检查模式：未推送。去掉 -DryRun 即执行。'
    return
  }

  # ─────────────────────────────────────────────── 远端仓库

  $exists = $true
  try { Invoke-RestMethod -Uri "https://api.github.com/repos/$Slug" -Headers $headers -TimeoutSec 30 | Out-Null }
  catch { $exists = $false }

  if (-not $exists) {
    if (-not $Create) {
      Fail "远端仓库 $Slug 不存在。加 -Create 让脚本自动创建。"
    }
    $body = @{
      name        = $Repo
      description = '今汐·洄天溯海 — a Jinhsi (Wuthering Waves) theme for the DeepSeek Harness web GUI: declarative skin, pure-CSS decoration, Feixun-style conversation, Wallpaper Engine aware.'
      private     = (-not $Public)
      has_issues  = $true
    } | ConvertTo-Json
    $created = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 60
    Ok "远端仓库已创建：$($created.html_url)（$(if ($Public) { 'public' } else { 'private' })）"
  } else {
    Info "远端仓库已存在：$Remote"
  }

  # ─────────────────────────────────────────────── 推送
  #
  # 用一次性、带凭据的 URL 推送，**不写进 .git/config**。
  # git 会把 https://user:pass@host 作为一次性 remote 接受，但直接写 remote 会持久化，
  # 所以这里用 push <url> 形式：git push <一次性URL> <ref>。

  $branch = git rev-parse --abbrev-ref HEAD
  if ($branch -eq 'HEAD') { $branch = 'main'; git branch -M main }

  $pushUrl = "https://x-access-token:$token@github.com/$Slug.git"
  Info "推送到 $Slug（分支 $branch）…"
  git push $pushUrl "refs/heads/${branch}:refs/heads/${branch}" 2>&1 | ForEach-Object {
    # git 可能把带 token 的 URL 打进错误输出，这里统一脱敏
    ($_ -replace [regex]::Escape($token), '***') | Write-Host
  }
  if ($LASTEXITCODE -ne 0) { Fail "推送失败（git 退出码 $LASTEXITCODE）" }
  Ok "已推送"

  # 设一个干净的上游，方便以后 git push
  git remote remove origin 2>$null | Out-Null
  git remote add origin $Remote
  git branch --set-upstream-to="origin/$branch" $branch 2>$null | Out-Null

  # ─────────────────────────────────────────────── 收尾断言
  $cfg = Get-Content (Join-Path $Root '.git\config') -Raw
  if ($cfg -match [regex]::Escape($token)) {
    Fail '令牌被写进了 .git/config —— 请手动清理后重试'
  }
  Ok '.git/config 中不含令牌'

  Write-Host ''
  Write-Host "仓库地址：https://github.com/$Slug" -ForegroundColor Cyan
} finally {
  Pop-Location
}

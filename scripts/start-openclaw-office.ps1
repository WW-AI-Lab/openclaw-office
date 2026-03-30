[CmdletBinding()]
param(
  [string]$Distro = "",
  [string]$OpenClawVersion = "2026.3.28",
  [int]$OfficePort = 5180,
  [int]$GatewayPort = 18789
)

$ErrorActionPreference = "Stop"

function Convert-ToWslPath {
  param([Parameter(Mandatory = $true)][string]$WindowsPath)

  $normalized = $WindowsPath -replace "\\", "/"
  if ($normalized -match "^([A-Za-z]):/(.*)$") {
    $drive = $Matches[1].ToLowerInvariant()
    $rest = $Matches[2]
    return "/mnt/$drive/$rest"
  }

  throw "无法转换为 WSL 路径: $WindowsPath"
}

function Convert-ToBashLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + ($Value -replace "'", "'""'""'") + "'"
}

function Get-PreferredDistro {
  $lines = & wsl.exe --list --quiet 2>$null
  if (-not $lines) {
    throw "未检测到可用的 WSL 发行版。"
  }

  $candidates = @()
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed) {
      continue
    }
    if ($trimmed -like "docker-desktop*") {
      continue
    }
    $candidates += $trimmed
  }

  if ($candidates.Count -eq 0) {
    throw "未找到可用于 OpenClaw 的 WSL Linux 发行版。"
  }

  return $candidates[0]
}

function Wait-ForHttp {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$Retries = 60,
    [int]$DelaySeconds = 2
  )

  for ($i = 0; $i -lt $Retries; $i++) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  return $false
}

function Get-WslCommandOutput {
  param(
    [Parameter(Mandatory = $true)][string]$DistroName,
    [Parameter(Mandatory = $true)][string]$Command,
    [string]$User = ""
  )

  $arguments = @("-d", $DistroName)
  if (-not [string]::IsNullOrWhiteSpace($User)) {
    $arguments += @("-u", $User)
  }
  $arguments += @("--", "bash", "-lc", $Command)

  $output = & wsl.exe @arguments 2>$null
  return (($output | ForEach-Object { $_.ToString().Trim() }) -join "`n").Trim()
}

function Test-VersionAtLeast {
  param(
    [Parameter(Mandatory = $true)][string]$Current,
    [Parameter(Mandatory = $true)][string]$Minimum
  )

  try {
    $currentVersion = [version]$Current
    $minimumVersion = [version]$Minimum
    return $currentVersion -ge $minimumVersion
  } catch {
    return $false
  }
}

function Ensure-WslBaseRuntime {
  param(
    [Parameter(Mandatory = $true)][string]$DistroName,
    [Parameter(Mandatory = $true)][string]$DesiredOpenClawVersion
  )

  $nodeVersionRaw = Get-WslCommandOutput -DistroName $DistroName -Command "node -v 2>/dev/null | sed 's/^v//'"
  $openclawVersion = Get-WslCommandOutput -DistroName $DistroName -Command "openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1"

  $needsNode = -not (Test-VersionAtLeast -Current $nodeVersionRaw -Minimum "22.14")
  $needsOpenClaw = $openclawVersion -ne $DesiredOpenClawVersion

  if (-not $needsNode -and -not $needsOpenClaw) {
    return
  }

  Write-Host "检测到 WSL 运行时需要补齐，正在以 root 安装 Node.js 与 OpenClaw..."
  $rootCommand = @(
    "set -euo pipefail"
    "export DEBIAN_FRONTEND=noninteractive"
    "apt-get update"
    "apt-get install -y ca-certificates curl gnupg"
    "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
    "apt-get install -y nodejs"
    "env SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@$DesiredOpenClawVersion"
  ) -join "; "

  & wsl.exe -d $DistroName -u root -- bash -lc $rootCommand
  if ($LASTEXITCODE -ne 0) {
    throw "WSL root 运行时安装失败，退出码：$LASTEXITCODE"
  }
}

function Get-WslGatewayToken {
  param([Parameter(Mandatory = $true)][string]$DistroName)

  $rawConfig = & wsl.exe -d $DistroName -- bash -lc "cat ~/.openclaw/openclaw.json" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $rawConfig) {
    throw "未能读取 WSL OpenClaw 配置文件。"
  }

  $config = ($rawConfig -join "`n") | ConvertFrom-Json
  $token = $config.gateway.auth.token
  if ([string]::IsNullOrWhiteSpace($token)) {
    throw "未能从 WSL OpenClaw 配置读取 Gateway Token。"
  }
  return $token.Trim()
}

function Stop-ExistingWindowsOffice {
  param([Parameter(Mandatory = $true)][string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $rawPid = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (-not $rawPid) {
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    return
  }

  $existingProcess = Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
  if ($existingProcess) {
    Stop-Process -Id $existingProcess.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }

  Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

function Start-WindowsOffice {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [Parameter(Mandatory = $true)][string]$GatewayToken,
    [Parameter(Mandatory = $true)][int]$OfficeListenPort,
    [Parameter(Mandatory = $true)][int]$GatewayListenPort,
    [Parameter(Mandatory = $true)][string]$PidFile,
    [Parameter(Mandatory = $true)][string]$LogFile
  )

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "当前 Windows 环境缺少 node，无法启动 OpenClaw Office。"
  }

  Stop-ExistingWindowsOffice -PidFile $PidFile

  $officeEntry = Join-Path $RepoRoot "bin\openclaw-office.js"
  $errorLogFile = [System.IO.Path]::ChangeExtension($LogFile, ".err.log")
  if (-not (Test-Path $officeEntry)) {
    throw "未找到 Office 启动入口: $officeEntry"
  }

  $process = Start-Process `
    -FilePath "node" `
    -ArgumentList @(
      $officeEntry,
      "--host", "127.0.0.1",
      "--port", "$OfficeListenPort",
      "--gateway", "ws://127.0.0.1:$GatewayListenPort",
      "--token", $GatewayToken
    ) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError $errorLogFile `
    -PassThru

  Set-Content -Path $PidFile -Value $process.Id -NoNewline
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "当前系统未安装 WSL。请先以管理员身份执行 wsl --install。"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$bootstrapWindowsPath = Join-Path $repoRoot "scripts\wsl-bootstrap-openclaw-office.sh"
$runtimeDir = Join-Path $repoRoot ".runtime"
$officePidFile = Join-Path $runtimeDir "openclaw-office-windows.pid"
$officeLogFile = Join-Path $runtimeDir "openclaw-office-windows.log"

if (-not (Test-Path $bootstrapWindowsPath)) {
  throw "未找到 WSL 部署脚本: $bootstrapWindowsPath"
}

if (-not (Test-Path $runtimeDir)) {
  New-Item -Path $runtimeDir -ItemType Directory | Out-Null
}

$resolvedDistro = if ([string]::IsNullOrWhiteSpace($Distro)) { Get-PreferredDistro } else { $Distro }
$wslRepoRoot = Convert-ToWslPath -WindowsPath $repoRoot
$wslBootstrapPath = Convert-ToWslPath -WindowsPath $bootstrapWindowsPath
$officeUrl = "http://127.0.0.1:$OfficePort"

Write-Host ""
Write-Host "OpenClaw Office WSL2 部署启动中..."
Write-Host "WSL 发行版: $resolvedDistro"
Write-Host "项目目录: $repoRoot"
Write-Host ""

Ensure-WslBaseRuntime -DistroName $resolvedDistro -DesiredOpenClawVersion $OpenClawVersion

$bashCommand = @(
  "export OPENCLAW_VERSION=$(Convert-ToBashLiteral -Value $OpenClawVersion)"
  "export OPENCLAW_OFFICE_PORT=$(Convert-ToBashLiteral -Value $OfficePort)"
  "export OPENCLAW_GATEWAY_PORT=$(Convert-ToBashLiteral -Value $GatewayPort)"
  "export OPENCLAW_SKIP_OFFICE_START='1'"
  "bash $(Convert-ToBashLiteral -Value $wslBootstrapPath) $(Convert-ToBashLiteral -Value $wslRepoRoot)"
) -join "; "

& wsl.exe -d $resolvedDistro --cd $wslRepoRoot bash -lc $bashCommand

if ($LASTEXITCODE -ne 0) {
  throw "WSL 部署脚本执行失败，退出码：$LASTEXITCODE"
}

$gatewayToken = Get-WslGatewayToken -DistroName $resolvedDistro
Start-WindowsOffice `
  -RepoRoot $repoRoot `
  -GatewayToken $gatewayToken `
  -OfficeListenPort $OfficePort `
  -GatewayListenPort $GatewayPort `
  -PidFile $officePidFile `
  -LogFile $officeLogFile

Write-Host ""
Write-Host "等待 OpenClaw Office 就绪..."

if (-not (Wait-ForHttp -Url $officeUrl)) {
  throw "OpenClaw Office 未在预期时间内启动：$officeUrl"
}

Start-Process $officeUrl | Out-Null

Write-Host ""
Write-Host "OpenClaw Office 已启动：$officeUrl"

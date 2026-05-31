param(
    [string]$InstallDir = "tools\butler"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$targetDir = Join-Path $root $InstallDir
$zipPath = Join-Path $targetDir "butler-windows-amd64.zip"
$url = "https://broth.itch.zone/butler/windows-amd64/LATEST/archive/default"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Write-Host "Downloading official itch.io butler from:"
Write-Host $url
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host "Extracting butler to $targetDir"
Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
Remove-Item -LiteralPath $zipPath -Force

$butler = Join-Path $targetDir "butler.exe"
if (!(Test-Path $butler)) {
    throw "butler.exe was not found after extraction."
}

& $butler version
Write-Host ""
Write-Host "Installed. Use this local executable:"
Write-Host $butler
Write-Host ""
Write-Host "Next authentication step:"
Write-Host "$butler login"

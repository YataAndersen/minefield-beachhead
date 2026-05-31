param(
    [string]$Target = "yata-andersen/minefield-beachhead:html5",
    [string]$ZipPath = "release\minefield-beachhead-html5.zip",
    [string]$ButlerPath = "",
    [string]$UserVersion = "",
    [switch]$SkipChecks,
    [switch]$PreviewOnly
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (!$ButlerPath) {
    $localButler = Join-Path $root "tools\butler\butler.exe"
    $ButlerPath = if (Test-Path $localButler) { $localButler } else { "butler" }
}

if (!$UserVersion) {
    $package = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
    $UserVersion = $package.version
}

if (!(Get-Command $ButlerPath -ErrorAction SilentlyContinue)) {
    throw "butler was not found. Run: powershell -ExecutionPolicy Bypass -File scripts\install-butler.ps1"
}

$defaultCreds = Join-Path $env:USERPROFILE ".config\itch\butler_creds"
if (!(Test-Path $defaultCreds) -and !$env:BUTLER_API_KEY) {
    throw "butler is installed, but it is not authenticated. Run: npm.cmd run itch:login"
}

if (!$SkipChecks) {
    Write-Host "Running release quality gate..."
    $env:NODE_OPTIONS = "--use-system-ca"
    npm.cmd run quality
    npm.cmd run playtest:preview
}

Write-Host "Building final dist..."
npm.cmd run build

Write-Host "Packaging HTML5 zip..."
Compress-Archive -Path "dist\*" -DestinationPath $ZipPath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath))
$hasRootIndex = [bool]($zip.Entries | Where-Object { $_.FullName -eq "index.html" })
$zip.Dispose()
if (!$hasRootIndex) {
    throw "The itch.io zip must contain index.html at the root."
}

if ($PreviewOnly) {
    Write-Host "Previewing itch.io upload diff..."
    & $ButlerPath push-preview --changes-only $ZipPath $Target
    exit $LASTEXITCODE
}

Write-Host "Publishing to itch.io target $Target with user version $UserVersion"
& $ButlerPath push $ZipPath $Target --userversion $UserVersion
exit $LASTEXITCODE

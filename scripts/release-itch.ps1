param(
    [string]$Version = "",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (!$Version) {
    $package = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
    $Version = $package.version
}

if ($Version.StartsWith("v")) {
    $Version = $Version.Substring(1)
}

$tag = "v$Version"

Write-Host "Running release checks for $tag..."
$env:NODE_OPTIONS = "--use-system-ca"
npm.cmd run quality
npm.cmd run playtest:preview
npm.cmd run build

Write-Host "Refreshing itch.io HTML5 zip..."
Compress-Archive -Path "dist\*" -DestinationPath "release\minefield-beachhead-html5.zip" -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path "release\minefield-beachhead-html5.zip"))
$hasRootIndex = [bool]($zip.Entries | Where-Object { $_.FullName -eq "index.html" })
$zip.Dispose()
if (!$hasRootIndex) {
    throw "The release zip must contain index.html at the root."
}

git add package.json package-lock.json README.txt release scripts .github .gitignore
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "Release $tag"
}

git tag -f $tag

if (!$NoPush) {
    git push origin HEAD
    git push origin $tag --force
}

Write-Host "Release $tag is ready."
if ($NoPush) {
    Write-Host "NoPush was set; push manually with:"
    Write-Host "git push origin HEAD"
    Write-Host "git push origin $tag --force"
}

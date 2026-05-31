$ErrorActionPreference = 'Stop'

$outDir = Join-Path (Get-Location) 'playtest-artifacts\post-onboarding-fix'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$target = Invoke-RestMethod -Method Put 'http://127.0.0.1:9222/json/new?http://127.0.0.1:5180/'
$wsUrl = $target.webSocketDebuggerUrl
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:msgId = 0

function Send-CDP($method, $params = @{}) {
    $script:msgId++
    $msg = @{ id = $script:msgId; method = $method; params = $params } | ConvertTo-Json -Depth 20 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    while ($true) {
        $chunks = [System.Collections.Generic.List[byte]]::new()
        do {
            $buf = New-Object byte[] 1048576
            $recv = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            for ($i = 0; $i -lt $recv.Count; $i++) { $chunks.Add($buf[$i]) }
        } while (-not $recv.EndOfMessage)
        $txt = [Text.Encoding]::UTF8.GetString($chunks.ToArray(), 0, $chunks.Count)
        if (-not $txt) { continue }
        $obj = $txt | ConvertFrom-Json
        if ($obj.id -eq $script:msgId) { return $obj }
    }
}

function Eval-JS($expr) {
    $r = Send-CDP 'Runtime.evaluate' @{ expression = $expr; awaitPromise = $true; returnByValue = $true }
    return $r.result.result.value
}

function Shot($name) {
    $r = Send-CDP 'Page.captureScreenshot' @{ format = 'png'; captureBeyondViewport = $false }
    [IO.File]::WriteAllBytes((Join-Path $outDir $name), [Convert]::FromBase64String($r.result.data))
}

Send-CDP 'Page.enable' | Out-Null
Send-CDP 'Runtime.enable' | Out-Null
Send-CDP 'Console.enable' | Out-Null
Start-Sleep -Milliseconds 1600

Eval-JS @"
(() => {
  localStorage.removeItem('mf_fragments_sec');
  localStorage.removeItem('mf_up_shielding_sec');
  localStorage.removeItem('mf_up_search_sec');
  localStorage.removeItem('mf_up_sync_sec');
  window.__ptErrors = [];
  const old = console.error;
  console.error = (...args) => { window.__ptErrors.push(args.map(String).join(' ')); old.apply(console, args); };
  location.reload();
  return true;
})()
"@ | Out-Null
Start-Sleep -Milliseconds 1600

Shot '01-menu.png'
Eval-JS "document.querySelector('#btn-node-desafio').click(); true" | Out-Null
Start-Sleep -Milliseconds 1800
Shot '02-sector1-start.png'
$freshStart = Eval-JS "JSON.stringify({sector:document.querySelector('#sector-display')?.innerText, focus:document.querySelector('#focus-display')?.innerText, mines:document.querySelector('#mines-display')?.innerText, timer:document.querySelector('#timer-display')?.innerText, notice:document.querySelector('#field-notice')?.innerText})"

Eval-JS "document.querySelector('#scan-button').click(); true" | Out-Null
Start-Sleep -Milliseconds 450
Shot '03-training-scan-pulse.png'
Start-Sleep -Milliseconds 1600
$freshScan = Eval-JS "JSON.stringify({sector:document.querySelector('#sector-display')?.innerText, focus:document.querySelector('#focus-display')?.innerText, mines:document.querySelector('#mines-display')?.innerText, notice:document.querySelector('#field-notice')?.innerText, noticeOpacity:getComputedStyle(document.querySelector('#field-notice')).opacity})"

$clicks = @(@(640,520),@(560,440),@(720,440),@(520,600),@(800,560),@(620,660),@(740,660),@(480,480))
$states = @()
foreach($pt in $clicks){
    Send-CDP 'Input.dispatchMouseEvent' @{ type='mousePressed'; x=$pt[0]; y=$pt[1]; button='left'; clickCount=1 } | Out-Null
    Send-CDP 'Input.dispatchMouseEvent' @{ type='mouseReleased'; x=$pt[0]; y=$pt[1]; button='left'; clickCount=1 } | Out-Null
    Start-Sleep -Milliseconds 700
    $states += (Eval-JS "JSON.stringify({focus:document.querySelector('#focus-display')?.innerText,mines:document.querySelector('#mines-display')?.innerText,timer:document.querySelector('#timer-display')?.innerText,notice:document.querySelector('#field-notice')?.innerText,noticeOpacity:getComputedStyle(document.querySelector('#field-notice')).opacity})")
}
Shot '04-after-click-pattern.png'

Eval-JS @"
(() => {
 localStorage.setItem('mf_fragments_sec', btoa('mf_salt_200000'));
 localStorage.setItem('mf_up_shielding_sec', btoa('mf_salt_4'));
 localStorage.setItem('mf_up_search_sec', btoa('mf_salt_4'));
 localStorage.setItem('mf_up_sync_sec', btoa('mf_salt_3'));
 location.reload();
 return true;
})()
"@ | Out-Null
Start-Sleep -Milliseconds 2000
Eval-JS "document.querySelector('#btn-node-desafio').click(); true" | Out-Null
Start-Sleep -Milliseconds 1800
Eval-JS "document.querySelector('#scan-button').click(); true" | Out-Null
Start-Sleep -Milliseconds 450
Shot '05-upgraded-training-scan.png'
$upgraded = Eval-JS "JSON.stringify({sector:document.querySelector('#sector-display')?.innerText, focus:document.querySelector('#focus-display')?.innerText, mines:document.querySelector('#mines-display')?.innerText, notice:document.querySelector('#field-notice')?.innerText})"

Send-CDP 'Emulation.setDeviceMetricsOverride' @{ width=390; height=844; deviceScaleFactor=1; mobile=$true } | Out-Null
Eval-JS "location.reload(); true" | Out-Null
Start-Sleep -Milliseconds 1500
Eval-JS "document.querySelector('#btn-node-desafio').click(); true" | Out-Null
Start-Sleep -Milliseconds 1800
Shot '06-mobile-sector1-start.png'
$mobile = Eval-JS "JSON.stringify({sector:document.querySelector('#sector-display')?.innerText, focus:document.querySelector('#focus-display')?.innerText, mines:document.querySelector('#mines-display')?.innerText, scanVisible:!!document.querySelector('#scan-button') && getComputedStyle(document.querySelector('#scan-button')).display !== 'none', inner:[innerWidth,innerHeight]})"

$errs = Eval-JS "JSON.stringify(window.__ptErrors || [])"
$report = [ordered]@{
    outDir = $outDir
    freshStart = $freshStart | ConvertFrom-Json
    freshScan = $freshScan | ConvertFrom-Json
    clickStates = $states | ForEach-Object { $_ | ConvertFrom-Json }
    upgraded = $upgraded | ConvertFrom-Json
    mobile = $mobile | ConvertFrom-Json
    consoleErrors = $errs | ConvertFrom-Json
}
$report | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $outDir 'report.json') -Encoding UTF8
$ws.Dispose()
$report | ConvertTo-Json -Depth 10

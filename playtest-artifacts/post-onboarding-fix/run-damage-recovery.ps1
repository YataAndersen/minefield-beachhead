$ErrorActionPreference = 'Stop'

$outDir = Join-Path (Get-Location) 'playtest-artifacts\post-onboarding-fix'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$target = Invoke-RestMethod -Method Put 'http://127.0.0.1:9222/json/new?http://127.0.0.1:5180/'
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
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
Start-Sleep -Milliseconds 1600
Eval-JS "localStorage.clear(); location.reload(); true" | Out-Null
Start-Sleep -Milliseconds 1600
Eval-JS "document.querySelector('#btn-node-desafio').click(); true" | Out-Null
Start-Sleep -Milliseconds 1600
Eval-JS "document.querySelector('#scan-button').click(); true" | Out-Null
Start-Sleep -Milliseconds 500

$hit = $null
foreach ($x in @(190,250,310,370,430,490,550,610,670,730)) {
    foreach ($y in @(270,330,390,450,510,570,630,690,750,810)) {
        Send-CDP 'Input.dispatchMouseEvent' @{ type='mousePressed'; x=$x; y=$y; button='left'; clickCount=1 } | Out-Null
        Send-CDP 'Input.dispatchMouseEvent' @{ type='mouseReleased'; x=$x; y=$y; button='left'; clickCount=1 } | Out-Null
        Start-Sleep -Milliseconds 950
        $state = Eval-JS "JSON.stringify({focus:document.querySelector('#focus-display')?.innerText,timer:document.querySelector('#timer-display')?.innerText,notice:document.querySelector('#field-notice')?.innerText,opacity:getComputedStyle(document.querySelector('#field-notice')).opacity})" | ConvertFrom-Json
        if ($state.notice -like 'MINE HIT*') {
            $hit = [ordered]@{ x=$x; y=$y; immediate=$state }
            break
        }
    }
    if ($hit) { break }
}

Start-Sleep -Milliseconds 2600
$after = Eval-JS "JSON.stringify({focus:document.querySelector('#focus-display')?.innerText,timer:document.querySelector('#timer-display')?.innerText,notice:document.querySelector('#field-notice')?.innerText,opacity:getComputedStyle(document.querySelector('#field-notice')).opacity})" | ConvertFrom-Json
Shot '07-damage-recovery-after.png'
$report = [ordered]@{ hit = $hit; afterRecovery = $after }
$report | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $outDir 'damage-recovery.json') -Encoding UTF8
$ws.Dispose()
$report | ConvertTo-Json -Depth 10

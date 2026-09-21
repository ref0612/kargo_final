# Dev helper: screenshot a mockup URL with headless Chrome. Usage: ./scripts/shot.ps1 "<url>" out.png [width] [height]
param([string]$Url, [string]$Out, [int]$W = 1440, [int]$H = 900)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path $env:TEMP ("kargo-shot-" + [guid]::NewGuid().ToString("N"))
Start-Process -FilePath $chrome -Wait -RedirectStandardError "$env:TEMP\shot.err" -ArgumentList `
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=$profile", "--window-size=$W,$H", "--virtual-time-budget=6000", "--screenshot=$Out", $Url
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue

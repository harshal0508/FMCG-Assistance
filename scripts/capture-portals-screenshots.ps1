$artifactDir = "C:\Users\harsh\.gemini\antigravity\brain\fe8f5507-fca0-4de4-881c-f87774f675fa"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$targets = @(
  @{ name="landing_two_portals.png"; url="http://localhost:3000/"; width=1440; height=1080 },
  @{ name="landing_two_portals_mobile.png"; url="http://localhost:3000/"; width=430; height=932 },
  @{ name="login_owner_direct.png"; url="http://localhost:3000/d/login"; width=430; height=932 },
  @{ name="login_owner_desktop.png"; url="http://localhost:3000/d/login"; width=1280; height=900 }
)

foreach ($t in $targets) {
  $outPath = Join-Path $artifactDir $t.name
  if (Test-Path $outPath) { Remove-Item -Force $outPath }
  Write-Host "Capturing $($t.name)..."

  $args = @(
    "--headless=new",
    "--hide-scrollbars",
    "--disable-gpu",
    "--virtual-time-budget=3000",
    "--window-size=$($t.width),$($t.height)",
    "--force-device-scale-factor=1",
    "--screenshot=$outPath",
    $t.url
  )

  Start-Process -FilePath $chrome -ArgumentList $args -Wait
  if (Test-Path $outPath) {
    Write-Host "  OK: $($t.name) saved."
  } else {
    Write-Host "  FAILED: $($t.name)"
  }
}

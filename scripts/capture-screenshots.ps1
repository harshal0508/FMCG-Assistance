$artifactDir = "C:\Users\harsh\.gemini\antigravity\brain\fe8f5507-fca0-4de4-881c-f87774f675fa"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$targets = @(
  @{ name="dashboard_desktop_en.png"; url="http://localhost:3000/d/dashboard?lang=en"; width=1440; height=900 },
  @{ name="dashboard_desktop_hi.png"; url="http://localhost:3000/d/dashboard?lang=hi"; width=1440; height=900 },
  @{ name="dashboard_mobile_en.png"; url="http://localhost:3000/d/dashboard?lang=en"; width=390; height=844 },
  @{ name="dashboard_mobile_hi.png"; url="http://localhost:3000/d/dashboard?lang=hi"; width=390; height=844 },
  @{ name="inventory_desktop_en.png"; url="http://localhost:3000/d/inventory?lang=en"; width=1440; height=900 },
  @{ name="inventory_desktop_hi.png"; url="http://localhost:3000/d/inventory?lang=hi"; width=1440; height=900 },
  @{ name="inventory_mobile_en.png"; url="http://localhost:3000/d/inventory?lang=en"; width=390; height=844 },
  @{ name="inventory_mobile_hi.png"; url="http://localhost:3000/d/inventory?lang=hi"; width=390; height=844 }
)

foreach ($t in $targets) {
  $outPath = Join-Path $artifactDir $t.name
  Write-Host "Capturing $($t.name) at $($t.width)x$($t.height)..."
  $args = @(
    "--headless=new",
    "--hide-scrollbars",
    "--disable-gpu",
    "--virtual-time-budget=5000",
    "--window-size=$($t.width),$($t.height)",
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

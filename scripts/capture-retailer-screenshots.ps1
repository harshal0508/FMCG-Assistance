$artifactDir = "C:\Users\harsh\.gemini\antigravity\brain\fe8f5507-fca0-4de4-881c-f87774f675fa"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$targets = @(
  @{ name="landing_distributors.png"; url="http://localhost:3000/"; width=1440; height=900 },
  @{ name="login_innovative.png"; url="http://localhost:3000/d/login"; width=1440; height=900 },
  @{ name="retailer_tab1_offers.png"; url="http://localhost:3000/r/demo-portal?tab=OFFERS"; width=430; height=932 },
  @{ name="retailer_tab2_catalog.png"; url="http://localhost:3000/r/demo-portal?tab=CATALOG"; width=430; height=932 },
  @{ name="retailer_tab3_orders.png"; url="http://localhost:3000/r/demo-portal?tab=ORDERS"; width=430; height=932 },
  @{ name="retailer_tab4_profile.png"; url="http://localhost:3000/r/demo-portal?tab=PROFILE"; width=430; height=932 },
  @{ name="retailer_you_save_modal.png"; url="http://localhost:3000/r/demo-portal?modal=you-save"; width=430; height=932 },
  @{ name="retailer_tab1_desktop.png"; url="http://localhost:3000/r/demo-portal?tab=OFFERS"; width=1440; height=900 },
  @{ name="retailer_tab2_desktop.png"; url="http://localhost:3000/r/demo-portal?tab=CATALOG"; width=1440; height=900 },
  @{ name="retailer_tab3_desktop.png"; url="http://localhost:3000/r/demo-portal?tab=ORDERS"; width=1440; height=900 },
  @{ name="retailer_tab4_desktop.png"; url="http://localhost:3000/r/demo-portal?tab=PROFILE"; width=1440; height=900 }
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

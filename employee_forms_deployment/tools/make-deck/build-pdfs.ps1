# build-pdfs.ps1 — Generate full-width SOPs using Chrome headless
param()

$chrome  = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$sopDir  = "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\docs\sop"
$tempDir = "$env:TEMP\sop_pdf_build"

# CSS to inject into each HTML for print
$printCss = @'
<style id="pdf-print-fix">
@page { margin: 0; size: 1500px auto; }
html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
/* Hide broken S3 logo image, show text fallback */
@media print {
  .sop-logo { display: none !important; }
  .pdf-logo  { display: block !important; }
}
.pdf-logo {
  display: none;
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
</style>
'@

$logoHtml = '<div class="pdf-logo">TEAM Group</div>'

$files = @(
    @{ src="new-hire-submitter.html";        out="new-hire-submitter.pdf" },
    @{ src="equipment-request-submitter.html"; out="equipment-request-submitter.pdf" },
    @{ src="termination-submitter.html";     out="termination-submitter.pdf" },
    @{ src="status-change-submitter.html";   out="status-change-submitter.pdf" }
)

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

foreach ($f in $files) {
    $srcPath  = "$sopDir\$($f.src)"
    $outPath  = "$sopDir\$($f.out)"
    $tmpPath  = "$tempDir\$($f.src)"

    Write-Host "Processing $($f.src)..."

    # Read source HTML
    $html = [System.IO.File]::ReadAllText($srcPath, [System.Text.Encoding]::UTF8)

    # Inject print fix CSS just before </head>
    $html = $html -replace '</head>', "$printCss`n</head>"

    # Inject text logo fallback right after the S3 img tag (insert sibling)
    $html = $html -replace '(<img\s[^>]*sop-logo[^>]*>)', "`$1`n    $logoHtml"

    # Write temp file as UTF-8
    [System.IO.File]::WriteAllText($tmpPath, $html, [System.Text.Encoding]::UTF8)

    # Build file:// URL  (forward slashes, encoded spaces)
    $fileUrl = "file:///" + ($tmpPath.Replace("\","/").Replace(" ","%20"))

    # Run Chrome headless
    Write-Host "  Generating PDF -> $outPath"
    $args = @(
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--print-to-pdf=`"$outPath`"",
        "--print-to-pdf-no-header",
        "--no-margins",
        "--virtual-time-budget=8000",
        "--run-all-compositor-stages-before-draw",
        $fileUrl
    )
    $proc = Start-Process -FilePath $chrome -ArgumentList $args -Wait -PassThru -NoNewWindow
    Write-Host "  Exit code: $($proc.ExitCode)"

    if (Test-Path $outPath) {
        $sz = (Get-Item $outPath).Length
        Write-Host "  OK: $outPath ($sz bytes)"
    } else {
        Write-Host "  FAILED: PDF not created"
    }
}

# Cleanup
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
Write-Host "Done."

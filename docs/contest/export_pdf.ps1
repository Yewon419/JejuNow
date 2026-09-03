# PowerPoint COM: pptx -> pdf + slide PNG previews. ASCII-only script (PS 5.1 reads .ps1 as ANSI).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = (Get-ChildItem -LiteralPath $here -Filter "*.pptx" | Where-Object { $_.Name -notlike "*~$*" } | Select-Object -First 1).FullName
$dst = [System.IO.Path]::ChangeExtension($src, ".pdf")
$prev = Join-Path $here "preview"
New-Item -ItemType Directory -Force -Path $prev | Out-Null
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($src, $true, $false, $false)
$pres.SaveAs($dst, 32)
$i = 1
foreach ($s in $pres.Slides) { $s.Export((Join-Path $prev ("slide-{0:D2}.png" -f $i)), "PNG", 1920, 1080); $i++ }
$pres.Close()
$app.Quit()
Write-Output "pdf: $dst"
Write-Output "slides: $($i - 1)"

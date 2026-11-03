# Regenerar ícones Android a partir de apps/pdv/public/gtech-pay-logo.jpg
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\apps\pdv\public\gtech-pay-logo.jpg'
if (-not (Test-Path $src)) { throw "Coloque gtech-pay-logo.jpg em apps/pdv/public" }
$android = Join-Path $PSScriptRoot '..\apps\pdv\android\app\src\main\res'
Add-Type -AssemblyName System.Drawing
function Save-SquareIcon([string]$outPath, [int]$size) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 22, 40))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $size, $size)
  $dir = Split-Path $outPath -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
@{
  'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192
}.GetEnumerator() | ForEach-Object {
  $f = $_.Key; $sz = [int]$_.Value
  Save-SquareIcon (Join-Path $android "$f\ic_launcher.png") $sz
  Save-SquareIcon (Join-Path $android "$f\ic_launcher_round.png") $sz
  Save-SquareIcon (Join-Path $android "$f\ic_launcher_foreground.png") $sz
}
Save-SquareIcon (Join-Path $android 'drawable\splash.png') 480
Write-Host 'Icones Android atualizados.'

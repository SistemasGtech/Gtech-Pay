# Gera icones Android (adaptive + legacy) a partir do banner gtech-pay-logo.jpg
# O banner e largo: recorta quadrado central e escala na "zona segura" (66%) do adaptive icon.
$ErrorActionPreference = 'Stop'
$repoRoot = Join-Path $PSScriptRoot '..'
$src = Join-Path $repoRoot 'apps\pdv\public\gtech-pay-logo.jpg'
$publicOut = Join-Path $repoRoot 'apps\pdv\public\gtech-pay-icon-square.png'
$publicOutDash = Join-Path $repoRoot 'apps\dashboard\public\gtech-pay-icon-square.png'
$android = Join-Path $repoRoot 'apps\pdv\android\app\src\main\res'

if (-not (Test-Path $src)) { throw "Arquivo nao encontrado: $src" }

Add-Type -AssemblyName System.Drawing

$BgColor = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
# Fundo igual ao tema do app / splash nativo (#0f172a)
$SplashBgColor = $BgColor
# Conteudo dentro da mascara do adaptive icon (~66% do canvas)
$SafeScale = 0.66

function New-CroppedSquare([System.Drawing.Image]$img) {
  $side = [Math]::Min($img.Width, $img.Height)
  $x = [int](($img.Width - $side) / 2)
  $y = [int](($img.Height - $side) / 2)
  $bmp = New-Object System.Drawing.Bitmap $side, $side
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $srcRect = New-Object System.Drawing.Rectangle $x, $y, $side, $side
  $destRect = New-Object System.Drawing.Rectangle 0, 0, $side, $side
  $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-LauncherBitmap([System.Drawing.Bitmap]$square, [int]$size, [double]$contentScale, [switch]$TransparentBg) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  if ($TransparentBg) {
    $g.Clear([System.Drawing.Color]::Transparent)
  } else {
    $g.Clear($BgColor)
  }
  $drawSize = [int][Math]::Round($size * $contentScale)
  $offset = [int](($size - $drawSize) / 2)
  $g.DrawImage($square, $offset, $offset, $drawSize, $drawSize)
  $g.Dispose()
  return $bmp
}

function New-SplashBitmap([System.Drawing.Bitmap]$square, [int]$width, [int]$height, [double]$logoScale) {
  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear($SplashBgColor)
  $drawSize = [int][Math]::Round([Math]::Min($width, $height) * $logoScale)
  $offsetX = [int](($width - $drawSize) / 2)
  $offsetY = [int](($height - $drawSize) / 2)
  $g.DrawImage($square, $offsetX, $offsetY, $drawSize, $drawSize)
  $g.Dispose()
  return $bmp
}

$source = [System.Drawing.Image]::FromFile($src)
try {
  $square = New-CroppedSquare $source

  # PNG quadrado para telas de login / favicon (512px)
  $ui512 = New-LauncherBitmap $square 512 0.92
  Save-Png $ui512 (Join-Path $repoRoot 'apps\pdv\public\gtech-pay-icon-square.png')
  Save-Png $ui512 (Join-Path $repoRoot 'apps\dashboard\public\gtech-pay-icon-square.png')
  Save-Png $ui512 (Join-Path $android 'drawable-nodpi\splash_logo.png')
  $ui512.Dispose()

  $densities = @{
    'mipmap-mdpi'    = 48
    'mipmap-hdpi'    = 72
    'mipmap-xhdpi'   = 96
    'mipmap-xxhdpi'  = 144
    'mipmap-xxxhdpi' = 192
  }

  foreach ($entry in $densities.GetEnumerator()) {
    $folder = $entry.Key
    $sz = [int]$entry.Value

    # Legacy / round: fundo + icone ~88%
    $legacy = New-LauncherBitmap $square $sz 0.88
    Save-Png $legacy (Join-Path $android "$folder\ic_launcher.png")
    Save-Png $legacy (Join-Path $android "$folder\ic_launcher_round.png")
    $legacy.Dispose()

    # Adaptive foreground: zona segura 66%
    $fg = New-LauncherBitmap $square $sz $SafeScale -TransparentBg
    Save-Png $fg (Join-Path $android "$folder\ic_launcher_foreground.png")
    $fg.Dispose()
  }

  # Splash Capacitor: telas inteiras (nao quadrado) — evita esticar e borrar no tablet
  $logoOnSplash = 0.38

  $portSplashes = @{
    'drawable-port-mdpi'    = @(320, 480)
    'drawable-port-hdpi'    = @(480, 800)
    'drawable-port-xhdpi'   = @(720, 1280)
    'drawable-port-xxhdpi'  = @(960, 1600)
    'drawable-port-xxxhdpi' = @(1280, 1920)
  }
  foreach ($entry in $portSplashes.GetEnumerator()) {
    $w = [int]$entry.Value[0]
    $h = [int]$entry.Value[1]
    $sp = New-SplashBitmap $square $w $h $logoOnSplash
    Save-Png $sp (Join-Path $android "$($entry.Key)\splash.png")
    $sp.Dispose()
  }

  $landSplashes = @{
    'drawable-land-mdpi'    = @(480, 320)
    'drawable-land-hdpi'    = @(800, 480)
    'drawable-land-xhdpi'   = @(1280, 720)
    'drawable-land-xxhdpi'  = @(1600, 960)
    'drawable-land-xxxhdpi' = @(1920, 1280)
  }
  foreach ($entry in $landSplashes.GetEnumerator()) {
    $w = [int]$entry.Value[0]
    $h = [int]$entry.Value[1]
    $sp = New-SplashBitmap $square $w $h $logoOnSplash
    Save-Png $sp (Join-Path $android "$($entry.Key)\splash.png")
    $sp.Dispose()
  }

  $splashDefault = New-SplashBitmap $square 720 1280 $logoOnSplash
  Save-Png $splashDefault (Join-Path $android 'drawable\splash.png')
  $splashDefault.Dispose()
  $square.Dispose()
} finally {
  $source.Dispose()
}

Write-Host 'OK: gtech-pay-icon-square.png + mipmaps Android (recorte quadrado + adaptive safe zone).'

# Значок для установщика: зелёный квадрат со скруглением и белая буква.
#
# Формат .ico собираем не руками, а через System.Drawing: у него есть
# готовое преобразование картинки в значок. Ручная сборка контейнера с
# несколькими размерами оказалась не стоящей возни — сперва Windows не
# понял PNG внутри мелких размеров, потом данные вовсе не дописались.
# Одного крупного размера достаточно: проводник уменьшит сам.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::Transparent)

# Зелёный из нашей темы — тот же, что у кнопок Grist
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 179, 120))

$d = [int]($size * 0.36)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($size - $d, 0, $d, $d, 270, 90)
$path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
$path.AddArc(0, $size - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath($brush, $path)

$font = New-Object System.Drawing.Font('Segoe UI', ($size * 0.56), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'
$fmt.LineAlignment = 'Center'
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString('D', $font, $white, (New-Object System.Drawing.RectangleF(0, 0, $size, $size)), $fmt)
$g.Dispose()

$out = Join-Path $PSScriptRoot 'docmost.ico'
$hicon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hicon)
$fs = [System.IO.File]::Create($out)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()

# Проверяем, что система его читает, и заодно рисуем предпросмотр
$check = New-Object System.Drawing.Icon($out)
$preview = $check.ToBitmap()
$preview.Save((Join-Path $PSScriptRoot 'icon-preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$w = $check.Width; $h = $check.Height
$check.Dispose(); $preview.Dispose()

$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
"значок готов: $out ($kb КБ), система читает его как ${w}x${h}"

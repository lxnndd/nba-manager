# 抓取 50 张真实 NBA 官方比赛照片作为主菜单背景（v2.7.0）
# 来源：NBA 官网各版块页面里内嵌的 cdn.nba.com/manage/... 官方照片（真实比赛/季后赛/新闻配图）
# 用法：pwsh -File tools/fetch-nba-photos.ps1
# 输出：src/assets/backdrops/nba-01.jpg ... nba-50.jpg（1920x1080，JPEG q80，单张约 300-450 KB）
# 说明：原图先下到 .test-out/nba-raw/（不参与打包），压缩后只把成品写进资源目录。
$ErrorActionPreference = 'Stop'
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $root '.test-out\nba-raw'
$out = Join-Path $root 'src\assets\backdrops'
New-Item -ItemType Directory -Force -Path $raw, $out | Out-Null

# 按"越像比赛照片越靠前"排序：近期比赛/季后赛/比赛日 → 历史 → 选秀
$pages = @('/news', '/playoffs', '/games', '/standings', '/history', '/draft')
$urls = New-Object System.Collections.Generic.List[string]
foreach ($p in $pages) {
  $tmp = Join-Path $raw ('page' + ($p -replace '[^a-z]', '') + '.html')
  curl.exe -s -L -m 30 -o $tmp -A $UA ("https://www.nba.com$p") 2>$null | Out-Null
  if (Test-Path $tmp) {
    $h = Get-Content $tmp -Raw
    $found = [regex]::Matches($h, "https://cdn\.nba\.com/manage/[^`"'\s<>\\]+\.(?:jpg|jpeg)")
    Write-Host ("  {0,-11} 提取 {1} 张" -f $p, $found.Count)
    foreach ($m in $found) { $urls.Add($m.Value) }
  }
}
$uniq = $urls | Select-Object -Unique
Write-Host ("候选去重后 {0} 张，开始下载并压缩前 50 张…" -f $uniq.Count)

Add-Type -AssemblyName System.Drawing
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ok = 0
$i = 0
foreach ($u in $uniq) {
  if ($ok -ge 50) { break }
  $i++
  $src = Join-Path $raw ("src-{0:d3}.jpg" -f $i)
  curl.exe -s -L -m 40 -o $src -A $UA $u 2>$null | Out-Null
  if (-not (Test-Path $src)) { continue }
  if ((Get-Item $src).Length -lt 60000) { Remove-Item $src -Force -EA SilentlyContinue; continue }
  try {
    $img = [System.Drawing.Image]::FromFile($src)
    # cover 裁剪：按较大的缩放比铺满 1920x1080，居中裁掉多余部分
    $scale = [Math]::Max(1920.0 / $img.Width, 1080.0 / $img.Height)
    $w = [int][Math]::Ceiling($img.Width * $scale)
    $h = [int][Math]::Ceiling($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap 1920, 1080
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, [int](1920 - $w) / 2, [int](1080 - $h) / 2, $w, $h)
    $params = New-Object System.Drawing.Imaging.EncoderParameters 1
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 80
    $ok++
    $dst = Join-Path $out ("nba-{0:d2}.jpg" -f $ok)
    $bmp.Save($dst, $enc, $params)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    Write-Host ("  [{0:d2}/50] {1}x{2} -> 1920x1080  {3} KB" -f $ok, $img.Width, $img.Height, [math]::Round((Get-Item $dst).Length / 1KB))
  } catch {
    Write-Host ("  跳过（解码失败）：{0}" -f $u)
  } finally {
    Remove-Item $src -Force -EA SilentlyContinue
  }
}
Write-Host ("完成：{0}/50 张已写入 src\assets\backdrops" -f $ok)

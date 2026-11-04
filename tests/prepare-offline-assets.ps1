# One-time acquisition of the application's existing pinned dependencies for tests.
# The Node extractor verifies npm archive integrity and writes per-asset hashes.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoRoot = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $repoRoot 'test-results/offline-source'
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
$packages = @(
  @{ name='leaflet'; version='1.9.4'; key='leaflet' },
  @{ name='proj4'; version='2.11.0'; key='proj4' },
  @{ name='three'; version='0.128.0'; key='three' },
  @{ name='@fortawesome/fontawesome-free'; version='6.5.2'; key='fontawesome' }
)
foreach ($package in $packages) {
  $uri = 'https://registry.npmjs.org/' + [Uri]::EscapeDataString($package.name) + '/' + $package.version
  $metadata = Invoke-RestMethod -Uri $uri -TimeoutSec 30
  if ($metadata.name -ne $package.name -or $metadata.version -ne $package.version -or -not $metadata.dist.integrity) { throw 'Unexpected package metadata' }
  $archiveUri = [Uri]$metadata.dist.tarball
  if ($archiveUri.Scheme -ne 'https' -or $archiveUri.Host -ne 'registry.npmjs.org') { throw 'Unexpected archive origin' }
  [IO.File]::WriteAllText((Join-Path $sourceDir ($package.key+'.json')), ($metadata | ConvertTo-Json -Depth 30), $utf8)
  Invoke-WebRequest -Uri $archiveUri -OutFile (Join-Path $sourceDir ($package.key+'.tgz')) -TimeoutSec 60
  Write-Output ('Downloaded pinned ' + $package.name + '@' + $package.version)
}
# Pin the actual CSS/font responses too, so tablet layout has no live font dependency.
$fontUrl = 'https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
$fontResponse = Invoke-WebRequest -Uri $fontUrl -TimeoutSec 30
$fontCss = [string]$fontResponse.Content
[IO.File]::WriteAllText((Join-Path $sourceDir 'google-fonts.css'), $fontCss, $utf8)
$fontEntries = @()
$fontIndex = 0
foreach ($match in [regex]::Matches($fontCss, 'url\((https://fonts\.gstatic\.com/[^)]+)\)')) {
  $url = $match.Groups[1].Value.Trim('"', "'")
  if ($fontEntries.url -contains $url) { continue }
  $fontIndex++
  $ext = [IO.Path]::GetExtension(([Uri]$url).AbsolutePath)
  $file = 'google-font-' + $fontIndex + $ext
  Invoke-WebRequest -Uri $url -OutFile (Join-Path $sourceDir $file) -TimeoutSec 30
  $fontEntries += @{ url=$url; source=$file }
}
if (-not $fontEntries.Count) { throw 'Font stylesheet did not contain actual font files' }
[IO.File]::WriteAllText((Join-Path $sourceDir 'google-fonts.json'), (@{url=$fontUrl;files=$fontEntries} | ConvertTo-Json -Depth 8), $utf8)
Write-Output ('Downloaded '+$fontEntries.Count+' pinned font responses')
foreach ($family in @('inter','sairacondensed','ibmplexmono')) {
  Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/google/fonts/main/ofl/'+$family+'/OFL.txt') -OutFile (Join-Path $sourceDir ($family+'-OFL.txt')) -TimeoutSec 30
}

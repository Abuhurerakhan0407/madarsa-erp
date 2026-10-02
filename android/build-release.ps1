param(
  [Parameter(Mandatory = $true)]
  [string]$JdkPath,

  [Parameter(Mandatory = $true)]
  [string]$AndroidSdkPath,

  [string]$ManifestPath = ".\twa-manifest.json",

  [string]$KeystorePassword = $env:BUBBLEWRAP_KEYSTORE_PASSWORD,

  [string]$KeyPassword = $env:BUBBLEWRAP_KEY_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $JdkPath)) {
  throw "JDK path does not exist: $JdkPath"
}
if (-not (Test-Path $AndroidSdkPath)) {
  throw "Android SDK path does not exist: $AndroidSdkPath"
}
if (-not (Test-Path $ManifestPath)) {
  throw "TWA manifest does not exist: $ManifestPath"
}
if (-not $KeystorePassword) {
  throw "BUBBLEWRAP_KEYSTORE_PASSWORD / -KeystorePassword is required for a signed release."
}
if (-not $KeyPassword) {
  throw "BUBBLEWRAP_KEY_PASSWORD / -KeyPassword is required for a signed release."
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$signingKeyPath = Join-Path (Split-Path $ManifestPath -Parent) $manifest.signingKey.path

if (-not (Test-Path $signingKeyPath)) {
  throw "Signing keystore is missing: $signingKeyPath"
}

$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $KeystorePassword
$env:BUBBLEWRAP_KEY_PASSWORD = $KeyPassword

Write-Output "Configuring Bubblewrap toolchain..."
pnpm dlx @bubblewrap/cli updateConfig --jdkPath="$JdkPath" --androidSdkPath="$AndroidSdkPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Checking Bubblewrap toolchain..."
pnpm dlx @bubblewrap/cli doctor
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Regenerating the Android project from twa-manifest.json..."
pnpm dlx @bubblewrap/cli update --manifest="$ManifestPath" --skipVersionUpgrade
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Building signed APK + AAB..."
pnpm dlx @bubblewrap/cli build --manifest="$ManifestPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Generating Digital Asset Links..."
pnpm dlx @bubblewrap/cli fingerprint generateAssetLinks --manifest="$ManifestPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path (Get-Location) "app-release-signed.apk"
$aab = Join-Path (Get-Location) "app-release-bundle.aab"
$assetLinks = Join-Path (Get-Location) "assetlinks.json"

if (-not (Test-Path $apk)) { throw "Signed APK was not generated." }
if (-not (Test-Path $aab)) { throw "Signed AAB was not generated." }
if (-not (Test-Path $assetLinks)) { throw "assetlinks.json was not generated." }

Write-Output "APK_SHA256=$((Get-FileHash $apk -Algorithm SHA256).Hash.ToLower())"
Write-Output "AAB_SHA256=$((Get-FileHash $aab -Algorithm SHA256).Hash.ToLower())"
Write-Output "ASSETLINKS=$assetLinks"
Write-Output "Android release artifacts are ready for device/domain verification."

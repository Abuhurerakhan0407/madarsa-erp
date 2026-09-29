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
$launcherActivityPath = Join-Path (Split-Path $ManifestPath -Parent) "app\src\main\java\in\ilmgaah\app\LauncherActivity.java"

if (-not (Test-Path $launcherActivityPath)) {
  throw "Trusted launcher source is missing: $launcherActivityPath"
}
$trustedLauncherSource = Get-Content $launcherActivityPath -Raw
if ($trustedLauncherSource -notmatch 'createTwaLauncher' -or $trustedLauncherSource -notmatch 'com\.android\.chrome') {
  throw "Trusted Chrome launcher override is missing before release build."
}

if (-not (Test-Path $signingKeyPath)) {
  throw "Signing keystore is missing: $signingKeyPath"
}

$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $KeystorePassword
$env:BUBBLEWRAP_KEY_PASSWORD = $KeyPassword

Write-Output "Configuring Bubblewrap toolchain..."
pnpm.cmd dlx @bubblewrap/cli updateConfig --jdkPath="$JdkPath" --androidSdkPath="$AndroidSdkPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Checking Bubblewrap toolchain..."
pnpm.cmd dlx @bubblewrap/cli doctor
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Regenerating the Android project from twa-manifest.json..."
pnpm.cmd dlx @bubblewrap/cli update --manifest="$ManifestPath" --skipVersionUpgrade
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Bubblewrap regenerates LauncherActivity and drops Ilmgaah's trusted Chrome provider override.
# Restore the reviewed launcher source before Gradle compiles the release artifact.
[IO.File]::WriteAllText($launcherActivityPath, $trustedLauncherSource, [Text.UTF8Encoding]::new($false))

Write-Output "Building signed APK + AAB..."
pnpm.cmd dlx @bubblewrap/cli build --manifest="$ManifestPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "Generating Digital Asset Links..."
pnpm.cmd dlx @bubblewrap/cli fingerprint generateAssetLinks --manifest="$ManifestPath"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path (Get-Location) "app-release-signed.apk"
$aab = Join-Path (Get-Location) "app-release-bundle.aab"
$assetLinks = Join-Path (Get-Location) "assetlinks.json"

if (-not (Test-Path $apk)) { throw "Signed APK was not generated." }
if (-not (Test-Path $aab)) { throw "Signed AAB was not generated." }
if (-not (Test-Path $assetLinks)) { throw "assetlinks.json was not generated." }

$assetLinksDocument = @(Get-Content $assetLinks -Raw | ConvertFrom-Json)
if ($assetLinksDocument.Count -lt 1) {
  throw "assetlinks.json is empty. Pin the release fingerprint in twa-manifest.json."
}
if ($assetLinksDocument[0].target.package_name -ne $manifest.packageId) {
  throw "assetlinks.json package does not match twa-manifest.json."
}
$expectedFingerprints = @($manifest.fingerprints | ForEach-Object { $_.value })
if ($expectedFingerprints.Count -lt 1) {
  throw "No release fingerprint is configured in twa-manifest.json."
}
$generatedFingerprints = @($assetLinksDocument[0].target.sha256_cert_fingerprints)
foreach ($fingerprint in $expectedFingerprints) {
  if ($generatedFingerprints -notcontains $fingerprint) {
    throw "assetlinks.json does not contain the configured release fingerprint."
  }
}

Write-Output "APK_SHA256=$((Get-FileHash $apk -Algorithm SHA256).Hash.ToLower())"
Write-Output "AAB_SHA256=$((Get-FileHash $aab -Algorithm SHA256).Hash.ToLower())"
Write-Output "ASSETLINKS=$assetLinks"
Write-Output "Android release artifacts are ready for device/domain verification."

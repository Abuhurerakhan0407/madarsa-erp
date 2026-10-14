[CmdletBinding()]
param(
    [Parameter()]
    [string]$KeystorePath
)

$ErrorActionPreference = "Stop"
$androidDir = $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($KeystorePath)) {
    $KeystorePath = $env:ILMGAAH_RELEASE_STORE_FILE
}
if ([string]::IsNullOrWhiteSpace($KeystorePath)) {
    $KeystorePath = Join-Path $androidDir "signing\ilmgaah-release.jks"
}
if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    throw "The existing release keystore was not found. Pass -KeystorePath to its protected location. Do not generate a replacement key."
}
$KeystorePath = (Resolve-Path -LiteralPath $KeystorePath).Path

$originalAndroidHome = $env:ANDROID_HOME
$originalAndroidSdkRoot = $env:ANDROID_SDK_ROOT
$sdkPath = $originalAndroidHome
if ([string]::IsNullOrWhiteSpace($sdkPath)) {
    $sdkPath = $originalAndroidSdkRoot
}
if ([string]::IsNullOrWhiteSpace($sdkPath)) {
    $localSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path -LiteralPath $localSdk -PathType Container) {
        $sdkPath = $localSdk
    }
}
if ([string]::IsNullOrWhiteSpace($sdkPath) -or -not (Test-Path -LiteralPath $sdkPath -PathType Container)) {
    throw "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT to the installed SDK."
}

$buildToolsRoot = Join-Path $sdkPath "build-tools"
$buildTools = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
    Sort-Object { [version]($_.Name -replace '-.*$', '') } -Descending |
    Select-Object -First 1
if (-not $buildTools) {
    throw "No Android build-tools installation found under $buildToolsRoot."
}
$aapt = Join-Path $buildTools.FullName "aapt.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"
$apkanalyzer = Join-Path $sdkPath "cmdline-tools\latest\bin\apkanalyzer.bat"
foreach ($toolPath in @($aapt, $apksigner, $apkanalyzer)) {
    if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
        throw "Required Android verification tool is missing: $toolPath"
    }
}

# This fingerprint is from the previously signed Ilmgaah release. A different key
# is a hard stop; never create or substitute a release key.
$expectedSignerSha256 = "118fa8ea1549c3b2c9addf45a7f0055cf2775e4e6a86ecc16589aa4a697020a7"
$productionApiOrigin = "https://www.ilmgaah.in"
$envNames = @(
    "ILMGAAH_RELEASE_STORE_FILE",
    "ILMGAAH_RELEASE_STORE_PASSWORD",
    "ILMGAAH_RELEASE_KEY_ALIAS",
    "ILMGAAH_RELEASE_KEY_PASSWORD"
)
$previousEnv = @{}
foreach ($name in $envNames) {
    $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$storePasswordSecure = $null
$keyPasswordSecure = $null

function ConvertTo-PlainText([System.Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

try {
    [Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "Process")
    [Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdkPath, "Process")
    $storePasswordSecure = Read-Host -Prompt "Existing release keystore password" -AsSecureString
    $keyPasswordSecure = Read-Host -Prompt "Password for the existing alias 'ilmgaah'" -AsSecureString

    [Environment]::SetEnvironmentVariable("ILMGAAH_RELEASE_STORE_FILE", $KeystorePath, "Process")
    [Environment]::SetEnvironmentVariable("ILMGAAH_RELEASE_KEY_ALIAS", "ilmgaah", "Process")
    $storePasswordPlain = ConvertTo-PlainText $storePasswordSecure
    $keyPasswordPlain = ConvertTo-PlainText $keyPasswordSecure
    [Environment]::SetEnvironmentVariable("ILMGAAH_RELEASE_STORE_PASSWORD", $storePasswordPlain, "Process")
    [Environment]::SetEnvironmentVariable("ILMGAAH_RELEASE_KEY_PASSWORD", $keyPasswordPlain, "Process")
    $storePasswordPlain = $null
    $keyPasswordPlain = $null

    Write-Output "Building native release for in.ilmgaah.app 1.2.1 (versionCode 6)."
    & (Join-Path $androidDir "gradlew.bat") --no-daemon -p $androidDir :app:assembleRelease
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle release build failed. No artifact is approved for distribution."
    }
}
finally {
    foreach ($name in $envNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], "Process")
    }
    [Environment]::SetEnvironmentVariable("ANDROID_HOME", $originalAndroidHome, "Process")
    [Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $originalAndroidSdkRoot, "Process")
    if ($storePasswordSecure) { $storePasswordSecure.Dispose() }
    if ($keyPasswordSecure) { $keyPasswordSecure.Dispose() }
}

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $apk -PathType Leaf)) {
    throw "Gradle completed but the expected release APK was not produced."
}

$badging = & $aapt dump badging $apk
if ($LASTEXITCODE -ne 0) {
    throw "Could not read APK package metadata. Do not distribute this artifact."
}
$packageLine = ($badging | Where-Object { $_ -match "^package:" } | Select-Object -First 1)
if ($packageLine -notmatch "name='in\.ilmgaah\.app'" -or
    $packageLine -notmatch "versionCode='6'" -or
    $packageLine -notmatch "versionName='1\.2\.1'") {
    throw "APK package identity/version mismatch. Do not distribute this artifact."
}
if (($badging | Out-String) -match "application-debuggable") {
    throw "APK is debuggable. Do not distribute this artifact."
}

$buildConfig = & $apkanalyzer dex code --class in.ilmgaah.app.BuildConfig $apk
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect BuildConfig. Do not distribute this artifact."
}
$buildConfigText = $buildConfig | Out-String
if ($buildConfigText -notmatch 'BUILD_TYPE:Ljava/lang/String; = "release"' -or
    $buildConfigText -notmatch 'const-string v0, "false"') {
    throw "APK BuildConfig does not prove a non-debug release build. Do not distribute this artifact."
}

$clientConfig = & $apkanalyzer dex code --class in.ilmgaah.app.ClientConfig $apk
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect ClientConfig. Do not distribute this artifact."
}
if (($clientConfig | Out-String) -notmatch [regex]::Escape($productionApiOrigin)) {
    throw "Production API origin was not found in the compiled client. Do not distribute this artifact."
}

$signerOutput = & $apksigner verify --print-certs $apk
if ($LASTEXITCODE -ne 0) {
    throw "APK signature verification failed. Do not distribute this artifact."
}
$signerText = $signerOutput | Out-String
$signerMatch = [regex]::Match(
    $signerText,
    '(?im)Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]+)'
)
if (-not $signerMatch.Success) {
    throw "Could not read the APK signing certificate fingerprint. Do not distribute this artifact."
}
$actualSignerSha256 = ($signerMatch.Groups[1].Value -replace ":", "").ToLowerInvariant()
if ($actualSignerSha256 -ne $expectedSignerSha256) {
    throw "Release signing certificate does not match the historic Ilmgaah release key. STOP; do not distribute or install."
}

$apkSha256 = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
Write-Output ""
Write-Output "RELEASE ARTIFACT VERIFIED (not installed or published)"
Write-Output "APK: $apk"
Write-Output "Package/version: in.ilmgaah.app 1.2.1 (versionCode 6)"
Write-Output "Release signer SHA-256: $($signerMatch.Groups[1].Value)"
Write-Output "APK SHA-256: $apkSha256"
Write-Output "No device installation, public copy, website deployment, or tenant/data change was performed."

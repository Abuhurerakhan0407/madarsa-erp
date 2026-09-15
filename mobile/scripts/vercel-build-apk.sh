#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="$ROOT/mobile"
OUT="$MOBILE/apk-dist"
SDK="$MOBILE/.android-sdk"
TOOLS_ZIP="$MOBILE/.commandlinetools.zip"

mkdir -p "$OUT" "$SDK/cmdline-tools"
rm -rf "$OUT"/* "$MOBILE/android" "$SDK" "$TOOLS_ZIP"
mkdir -p "$OUT" "$SDK/cmdline-tools"

echo '== Ilmgaah isolated Android builder =='
echo "Commit: ${VERCEL_GIT_COMMIT_SHA:-unknown}"
echo "Branch: ${VERCEL_GIT_COMMIT_REF:-unknown}"
echo 'This build changes no ERP runtime/database state.'

# Capacitor 8 requires Java 21. Vercel's base image includes Java 11,
# so install Corretto 21 only inside this disposable build container.
dnf install -y java-21-amazon-corretto-devel >/dev/null
JAVA_BIN="$(readlink -f "$(command -v javac)")"
export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

# Official Android command-line tools, pinned and checksum verified.
CMDLINE_VERSION='15859902'
CMDLINE_SHA256='4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583'
curl --fail --location --retry 3 \
  "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VERSION}_latest.zip" \
  --output "$TOOLS_ZIP"
printf '%s  %s\n' "$CMDLINE_SHA256" "$TOOLS_ZIP" | sha256sum --check
unzip -q "$TOOLS_ZIP" -d "$SDK/cmdline-tools"
mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
rm -f "$TOOLS_ZIP"

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$SDK/build-tools/36.0.0:$PATH"

# Accept official Android SDK licenses non-interactively in the disposable builder.
set +o pipefail
yes | sdkmanager --sdk_root="$SDK" --licenses >/dev/null
set -o pipefail
sdkmanager --sdk_root="$SDK" \
  'platform-tools' \
  'platforms;android-36' \
  'build-tools;36.0.0'

# Build only the isolated mobile workspace. Root ERP dependencies are not touched.
npm --prefix "$MOBILE" install --no-audit --no-fund
npm --prefix "$MOBILE" run build

# Internal-development APK: loads the canonical HTTPS ERP at runtime so web
# deployments appear without rebuilding/reinstalling this APK.
cp "$MOBILE/capacitor.config.dev.ts" "$MOBILE/capacitor.config.ts"
(
  cd "$MOBILE"
  npx cap add android
  npx cap sync android
  npm run assets:android
)

# Defense-in-depth Android network/backup policy for the generated project.
mkdir -p "$MOBILE/android/app/src/main/res/xml"
cat > "$MOBILE/android/app/src/main/res/xml/network_security_config.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
XML

python3 - <<'PY'
from pathlib import Path
import os, re

mobile = Path(os.environ.get('MOBILE_DIR', 'mobile'))
manifest = mobile / 'android/app/src/main/AndroidManifest.xml'
text = manifest.read_text(encoding='utf-8')
text = text.replace('android:allowBackup="true"', 'android:allowBackup="false"', 1)
if 'android:allowBackup=' not in text:
    text = text.replace('<application', '<application\n        android:allowBackup="false"', 1)
if 'android:usesCleartextTraffic=' not in text:
    text = text.replace('<application', '<application\n        android:usesCleartextTraffic="false"', 1)
if 'android:networkSecurityConfig=' not in text:
    text = text.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"', 1)
manifest.write_text(text, encoding='utf-8')

gradle = mobile / 'android/app/build.gradle'
src = gradle.read_text(encoding='utf-8')
build_number = int(os.environ.get('VERCEL_DEPLOYMENT_ID', '0').encode().hex()[:6], 16) % 2000000000 + 1
src = re.sub(r'versionCode\s+\d+', f'versionCode {build_number}', src, count=1)
src = re.sub(r'versionName\s+"[^"]+"', 'versionName "0.1.0-dev"', src, count=1)
gradle.write_text(src, encoding='utf-8')
PY

# Assert generated hardening before compiling.
grep -q 'android:allowBackup="false"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
grep -q 'android:usesCleartextTraffic="false"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
grep -q 'android:networkSecurityConfig="@xml/network_security_config"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
grep -q 'cleartextTrafficPermitted="false"' "$MOBILE/android/app/src/main/res/xml/network_security_config.xml"
grep -q 'targetSdkVersion = 36' "$MOBILE/android/variables.gradle"
grep -q 'compileSdkVersion = 36' "$MOBILE/android/variables.gradle"

export GRADLE_OPTS='-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8'
(
  cd "$MOBILE/android"
  chmod +x gradlew
  ./gradlew --no-daemon lintDebug testDebugUnitTest assembleDebug
)

APK="$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
APKSIGNER="$(find "$SDK/build-tools" -type f -name apksigner | sort -V | tail -n 1)"
AAPT="$(find "$SDK/build-tools" -type f -name aapt | sort -V | tail -n 1)"
"$APKSIGNER" verify --verbose --print-certs "$APK" | tee "$OUT/apk-signature.txt"
"$AAPT" dump badging "$APK" | tee "$OUT/apk-badging.txt"
grep -q "package: name='in.ilmgaah.app'" "$OUT/apk-badging.txt"
grep -q "targetSdkVersion:'36'" "$OUT/apk-badging.txt"

cp "$APK" "$OUT/Ilmgaah-Android-Dev.apk"
(
  cd "$OUT"
  sha256sum Ilmgaah-Android-Dev.apk > Ilmgaah-Android-Dev.sha256
)

cat > "$OUT/BUILD-INFO.txt" <<EOF
Ilmgaah Android Development APK
Commit: ${VERCEL_GIT_COMMIT_SHA:-unknown}
Branch: ${VERCEL_GIT_COMMIT_REF:-unknown}
App ID: in.ilmgaah.app
Mode: internal development / live web-backed
Canonical ERP origin: https://madarsa-erp.vercel.app/login
Target SDK: 36
Minimum SDK: 24
Java: 21
Capacitor: 8.5.2
Signing: Android debug signing (internal QA only)
Auto-update behavior: web-layer changes appear from the canonical hosted ERP without APK rebuild.
Native/plugin/manifest changes still require a new binary.
Do not submit this development build to Google Play.
EOF

cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Ilmgaah Android Development Build</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#0f3329;color:#f4f0e7;min-height:100vh;display:grid;place-items:center;padding:24px}main{max-width:620px;border:1px solid #ffffff20;border-radius:28px;padding:32px;background:#ffffff0c}h1{font-size:32px;margin:0 0 12px}p{line-height:1.55;color:#f4f0e7cc}.button{display:inline-block;margin-top:14px;padding:14px 18px;border-radius:14px;background:#f4f0e7;color:#194d3d;text-decoration:none;font-weight:700}code{word-break:break-all;color:#9de0c8}.small{font-size:13px;opacity:.72}</style>
</head>
<body><main><h1>Ilmgaah Android</h1><p>Internal development APK. It follows the hosted Ilmgaah ERP during active development, so web-layer releases appear without reinstalling this APK.</p><a class="button" href="/Ilmgaah-Android-Dev.apk">Download APK</a><p class="small">Internal QA build — not a Google Play production binary.</p></main></body>
</html>
HTML

echo '== APK build complete =='
ls -lh "$OUT/Ilmgaah-Android-Dev.apk"
cat "$OUT/Ilmgaah-Android-Dev.sha256"

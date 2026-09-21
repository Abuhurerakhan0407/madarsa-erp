#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="$ROOT/mobile"
OUT="$MOBILE/apk-dist"
SDK="$MOBILE/.android-sdk"
TOOLS_ZIP="$MOBILE/.commandlinetools.zip"
CONFIG_BACKUP="$MOBILE/.capacitor.config.production.tmp"

mkdir -p "$OUT" "$SDK/cmdline-tools"
rm -rf "$OUT"/* "$MOBILE/android" "$SDK" "$TOOLS_ZIP" "$CONFIG_BACKUP"
mkdir -p "$OUT" "$SDK/cmdline-tools"
cp "$MOBILE/capacitor.config.ts" "$CONFIG_BACKUP"
trap 'cp "$CONFIG_BACKUP" "$MOBILE/capacitor.config.ts" 2>/dev/null || true; rm -f "$CONFIG_BACKUP"' EXIT

echo '== Ilmgaah isolated Android builder =='
echo "Commit: ${VERCEL_GIT_COMMIT_SHA:-unknown}"
echo "Branch: ${VERCEL_GIT_COMMIT_REF:-unknown}"
echo 'This build changes no ERP runtime/database state.'

dnf install -y java-21-amazon-corretto-devel >/dev/null
JAVA_BIN="$(readlink -f "$(command -v javac)")"
export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

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

set +o pipefail
yes | sdkmanager --sdk_root="$SDK" --licenses >/dev/null
set -o pipefail
sdkmanager --sdk_root="$SDK" \
  'platform-tools' \
  'platforms;android-36' \
  'build-tools;36.0.0'

export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}"
export VITE_ILMGAAH_API_ORIGIN="${VITE_ILMGAAH_API_ORIGIN:-https://madarsa-erp.vercel.app}"
if [[ -n "$VITE_SUPABASE_URL" && -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]]; then
  echo 'Native preview public auth configuration: available'
else
  echo 'Native preview public auth configuration: not injected; UI will remain safely unconfigured'
fi

npm --prefix "$MOBILE" install --include=dev --no-audit --no-fund
npm --prefix "$MOBILE" run build

APKSIGNER="$(find "$SDK/build-tools" -type f -name apksigner | sort -V | tail -n 1)"
AAPT="$(find "$SDK/build-tools" -type f -name aapt | sort -V | tail -n 1)"
export GRADLE_OPTS='-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8'
export ILMGAAH_MOBILE_DIR="$MOBILE"

harden_android() {
  local version_name="$1"
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

  ILMGAAH_VERSION_NAME="$version_name" python3 - <<'PY'
from pathlib import Path
import os, re

mobile = Path(os.environ['ILMGAAH_MOBILE_DIR'])
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
sha = os.environ.get('VERCEL_GIT_COMMIT_SHA', '1')
try:
    build_number = (int(sha[:8], 16) % 2_000_000_000) + 1
except ValueError:
    build_number = 1
src = re.sub(r'versionCode\s+\d+', f'versionCode {build_number}', src, count=1)
src = re.sub(r'versionName\s+"[^"]+"', f'versionName "{os.environ["ILMGAAH_VERSION_NAME"]}"', src, count=1)
gradle.write_text(src, encoding='utf-8')
PY

  grep -q 'android:allowBackup="false"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
  grep -q 'android:usesCleartextTraffic="false"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
  grep -q 'android:networkSecurityConfig="@xml/network_security_config"' "$MOBILE/android/app/src/main/AndroidManifest.xml"
  grep -q 'cleartextTrafficPermitted="false"' "$MOBILE/android/app/src/main/res/xml/network_security_config.xml"
  grep -q 'targetSdkVersion = 36' "$MOBILE/android/variables.gradle"
  grep -q 'compileSdkVersion = 36' "$MOBILE/android/variables.gradle"
}

verify_and_export() {
  local output_name="$1"
  local expected_package="$2"
  local report_prefix="$3"
  local apk="$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"

  test -s "$apk"
  npm --prefix "$MOBILE" run privacy:check:generated
  "$APKSIGNER" verify --verbose --print-certs "$apk" | tee "$OUT/${report_prefix}-signature.txt"
  "$AAPT" dump badging "$apk" | tee "$OUT/${report_prefix}-badging.txt"
  "$AAPT" dump permissions "$apk" | tee "$OUT/${report_prefix}-permissions.txt"
  grep -q "package: name='${expected_package}'" "$OUT/${report_prefix}-badging.txt"
  grep -q "targetSdkVersion:'36'" "$OUT/${report_prefix}-badging.txt"
  cp "$apk" "$OUT/$output_name"
  (cd "$OUT" && sha256sum "$output_name" > "${output_name}.sha256")
}

build_variant() {
  local config_file="$1"
  local version_name="$2"
  local output_name="$3"
  local expected_package="$4"
  local report_prefix="$5"
  local run_full_checks="$6"

  echo "== Building ${output_name} =="
  rm -rf "$MOBILE/android"
  cp "$MOBILE/$config_file" "$MOBILE/capacitor.config.ts"
  (
    cd "$MOBILE"
    npx cap add android
    npx cap sync android
    npm run assets:android
  )
  harden_android "$version_name"

  (
    cd "$MOBILE/android"
    chmod +x gradlew
    if [[ "$run_full_checks" == 'yes' ]]; then
      ./gradlew --no-daemon lintDebug testDebugUnitTest assembleDebug
    else
      ./gradlew --no-daemon assembleDebug
    fi
  )

  verify_and_export "$output_name" "$expected_package" "$report_prefix"
}

build_variant \
  'capacitor.config.preview.ts' \
  '0.2.0-native-preview' \
  'Ilmgaah-Android-Native-Preview.apk' \
  'in.ilmgaah.app.preview' \
  'native-preview' \
  'yes'

build_variant \
  'capacitor.config.dev.ts' \
  '0.1.0-dev' \
  'Ilmgaah-Android-Dev.apk' \
  'in.ilmgaah.app' \
  'dev' \
  'no'

cat > "$OUT/BUILD-INFO.txt" <<EOF
Ilmgaah Android QA Artifacts
Commit: ${VERCEL_GIT_COMMIT_SHA:-unknown}
Branch: ${VERCEL_GIT_COMMIT_REF:-unknown}
Target SDK: 36
Minimum SDK: 24
Java: 21
Capacitor: 8.5.2
Signing: Android debug signing (internal QA only)
Privacy gate: source/config + generated/merged Android manifests

Ilmgaah-Android-Dev.apk
App ID: in.ilmgaah.app
Mode: internal development / live web-backed
Canonical ERP origin: https://madarsa-erp.vercel.app/login
Behavior: ordinary web-layer ERP updates appear without rebuilding/reinstalling.

Ilmgaah-Android-Native-Preview.apk
App ID: in.ilmgaah.app.preview
Mode: bundled native-preview React/Capacitor UI
Behavior: installs beside Dev APK; validates the production mobile architecture without replacing Dev.
Native/API integration remains under active development.

Neither artifact is a Google Play production binary.
EOF

cat > "$OUT/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Ilmgaah Android QA Builds</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#0f3329;color:#f4f0e7;min-height:100vh;display:grid;place-items:center;padding:24px}main{max-width:680px;border:1px solid #ffffff20;border-radius:28px;padding:32px;background:#ffffff0c}h1{font-size:32px;margin:0 0 12px}p{line-height:1.55;color:#f4f0e7cc}.buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.button{display:inline-block;padding:14px 18px;border-radius:14px;background:#f4f0e7;color:#194d3d;text-decoration:none;font-weight:750}.button.alt{background:#ffffff12;color:#f4f0e7;border:1px solid #ffffff22}.small{font-size:13px;opacity:.72;margin-top:18px}</style>
</head>
<body><main><h1>Ilmgaah Android</h1><p><strong>Dev APK</strong> follows the hosted Ilmgaah ERP automatically. <strong>Native Preview</strong> installs separately and lets us test the bundled production-mobile UI while development continues.</p><div class="buttons"><a class="button" href="/Ilmgaah-Android-Dev.apk">Download Dev APK</a><a class="button alt" href="/Ilmgaah-Android-Native-Preview.apk">Download Native Preview</a></div><p class="small">Internal QA builds only — neither is a Google Play production binary.</p></main></body>
</html>
HTML

echo '== APK builds complete =='
ls -lh "$OUT"/*.apk
cat "$OUT/Ilmgaah-Android-Dev.apk.sha256"
cat "$OUT/Ilmgaah-Android-Native-Preview.apk.sha256"

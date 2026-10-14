# Ilmgaah Android — Native Client Release

## Canonical application

This project currently uses the **native Android app** in `android/app` (`MainActivity`, `NativeApi`, and `ClientConfig`). Do not regenerate a Trusted Web Activity with Bubblewrap or create a second Android package.

- Package ID: `in.ilmgaah.app`
- Release candidate: `1.2.1` (`versionCode 6`)
- Minimum Android version: API 23
- Debug builds: QA API only; **never distribute**
- Release builds: `https://www.ilmgaah.in`

The installed Redmi build inspected during release triage is version `1.2.0` / code `5`, marked debuggable, and signed with an Android debug certificate. A correctly signed release has a different certificate, so Android will not update that install in place. Do not uninstall or replace it until its local data/recovery needs are understood and the owner approves the installation plan. Keep the package ID unchanged.

## Existing release key — do not replace

Use only the existing keystore and alias:

- Keystore filename: `ilmgaah-release.jks`
- Alias: `ilmgaah`
- Expected release certificate SHA-256: `11:8F:A8:EA:15:49:C3:B2:C9:AD:DF:45:A7:F0:05:5C:F2:77:5E:4E:6A:86:EC:C1:65:89:AA:4A:69:70:20:A7`

The keystore is intentionally outside Git. Do not generate another key, add the keystore/passwords to the repository, upload them to chat, or place passwords in command history. The build script prompts for passwords as secure input and clears the temporary environment variables.

## Build the signed release candidate

On the authorized Windows build machine, use the existing keystore path. If the key is not at `android/signing/ilmgaah-release.jks`, pass its protected path explicitly:

```powershell
.\android\build-native-release.ps1 -KeystorePath "C:\secure\path\ilmgaah-release.jks"
```

The script uses Gradle `--no-daemon`, builds only `:app:assembleRelease`, then verifies the package, version, non-debug build, production API configuration and exact historic signing certificate. It prints the resulting APK SHA-256 only after those checks pass. It does **not** install the APK, copy it to a public download location, deploy the website, or change tenant data.

Expected local artifact (not automatically shipped):
`android/app/build/outputs/apk/release/app-release.apk`

A missing/wrong key or password, unexpected certificate fingerprint, debug build type, package/version mismatch, or invalid signature must stop release. Never “fix” a signing failure by using the debug key or creating a replacement key.

## Local development build (QA only)

```powershell
.\android\gradlew.bat -p .\android :app:assembleDebug
```

The resulting `app-debug.apk` uses the QA API and is for development only. It is not the client deliverable and must not be installed over the client build as a workaround for login errors.

## Client release acceptance — still required

A signed artifact is not sufficient by itself. Before handover:

1. Resolve the authoritative Jamia tenant using approved onboarding evidence. Tenant 5 versus tenant 7 is still a release blocker; do not import until this is resolved.
2. Test the owner's valid sign-in against production and verify membership bootstrap selects the approved tenant. The inspected debug APK was pointed at a different QA Supabase project; do not reset the owner's password based on that failure.
3. Reconcile the supplied roster, approve branch/session/program/group/numbering mappings, run a dry run, and import only into the approved tenant. Current import count is **0/376**.
4. Verify APK package/version, release certificate fingerprint and SHA-256 against the build output. Do not share or ship a debug APK.
5. Agree on a backup/recovery plan before removing the currently installed debug-signed package; package-signature mismatch prevents an in-place update.
6. On the physical device, verify login, dashboard zero/empty states, navigation, attendance, Urdu/RTL, document/PDF flows, sign-out and reopen. Re-test the app after install; do not infer acceptance from unit tests.

Coordinate all release work through [stop-ship issue #151](https://github.com/Abuhurerakhan0407/madarsa-erp/issues/151). No production deployment, tenant change, membership change or roster write is authorized by this document.

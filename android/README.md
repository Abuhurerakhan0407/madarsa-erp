# Ilmgaah Android Release

This directory contains the Trusted Web Activity (TWA) release configuration for the Ilmgaah Android app.

## Release identity

- Android package: `in.ilmgaah.app`
- Trusted origin: `https://www.ilmgaah.in`
- App name: `Ilmgaah`
- Current version: `1.0.0`
- Version code: `3`
- Start URL: `/login?source=app`
- Notifications: enabled
- Minimum Android SDK: 23

## Security rules

- Never commit the release keystore.
- Never commit keystore passwords.
- Never expose signing fingerprints except where required for Digital Asset Links.
- Never replace the release keystore after customers have installed the app. Future updates must be signed with the same key.
- Do not build a production APK from a different package ID.
- Do not publish `assetlinks.json` until the release key fingerprint is known and verified.

The signing directory is ignored by Git:

`android/signing/`

Expected release key:

`android/signing/ilmgaah-release.jks`

Expected alias:

`ilmgaah`

## Prerequisites

1. Node.js / pnpm
2. JDK 17
3. Android command line tools / SDK
4. Bubblewrap CLI (invoked through `pnpm dlx @bubblewrap/cli`)
5. the final Ilmgaah PWA manifest and icon assets deployed to `ilmgaah.in`

Bubblewrap currently requires JDK 17. Do not substitute a different Java version without re-validating the current Bubblewrap requirements.

## Before building

From the repository root, validate:

```powershell
pnpm install --frozen-lockfile
pnpm exec vitest run src/lib/mobile/android-install-manifest.test.ts src/lib/mobile/twa-release-config.test.ts
pnpm build
```

The live site must serve:

- `https://www.ilmgaah.in/manifest.webmanifest`
- `https://www.ilmgaah.in/icons/icon-512.png`
- `https://www.ilmgaah.in/icons/maskable-512.png`

Do not proceed with final TWA validation if these URLs are missing or return non-2xx responses.

## Generate the release keystore

Generate the key once and preserve it securely.

Example using the JDK 17 `keytool`:

```powershell
New-Item -ItemType Directory -Force .\android\signing | Out-Null

keytool -genkeypair `
  -keystore .\android\signing\ilmgaah-release.jks `
  -alias ilmgaah `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

Use a strong unique keystore password and key password.

Store the passwords outside the repository.

## Build

Open PowerShell in the `android` directory.

Set the signing passwords only in the current process:

```powershell
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = "<release-keystore-password>"
$env:BUBBLEWRAP_KEY_PASSWORD = "<release-key-password>"
```

Run:

```powershell
.\build-release.ps1 `
  -JdkPath "<JDK-17-root>" `
  -AndroidSdkPath "<Android-SDK-root>"
```

The script performs:

1. Bubblewrap toolchain configuration
2. Bubblewrap doctor
3. Android project regeneration from `twa-manifest.json`
4. signed APK build
5. signed Android App Bundle build
6. Digital Asset Links generation
7. SHA-256 output for release artifacts

Expected artifacts:

- `app-release-signed.apk`
- `app-release-bundle.aab`
- `assetlinks.json`

## Digital Asset Links

The TWA will only run as a fully trusted fullscreen app after the domain serves the correct Digital Asset Links file.

After the release key fingerprint is generated, copy the generated file to:

`public/.well-known/assetlinks.json`

Then deploy the matching website commit.

Verify:

`https://www.ilmgaah.in/.well-known/assetlinks.json`

The published file must reference:

- package `in.ilmgaah.app`
- the exact SHA-256 fingerprint of the final release signing key

Do not use a debug signing fingerprint.

## Device acceptance

Install the signed APK on at least two Android devices if available.

Required checks:

1. installation succeeds without Android package/signature warnings
2. launcher icon is correct
3. app opens at Ilmgaah login
4. no browser toolbar is shown after Digital Asset Links verification
5. login works
6. admin/teacher/parent navigation works as applicable
7. Urdu/RTL renders correctly
8. back button behavior is sane
9. file/PDF actions work
10. parent notification permission/delegation works
11. app survives close/reopen
12. network outage produces an understandable state
13. sign-out works
14. reinstall/update with a newer build signed by the same key works

## Release evidence

For the final shipped APK record:

- Git SHA
- package ID
- app version
- app version code
- APK SHA-256
- AAB SHA-256
- release signing SHA-256 fingerprint
- Android devices tested
- Android versions tested
- `assetlinks.json` URL verified
- installed app launch/login/notification result
- release date

## Website install button

Only after the final APK is signed and device-tested:

1. place the approved APK at the intended public download location
2. add the Ilmgaah website **App Install** button
3. link it to the final approved artifact
4. verify download/install on Android
5. do not link a debug/unsigned/intermediate APK

## Release rule

The APK branch can be developed independently, but the website/PWA manifest changes must be merged into the final Ilmgaah RC and re-run through the full web release gates before production.

# ZBR Courier — Android Release Runbook

**How this app ships:** the AAB is built **locally** with `expo prebuild` + Gradle and
uploaded **by hand** to Google Play Console. There is no EAS in this repo — `eas.json`
was deleted deliberately. Nothing in CI builds the release.

This document is the mechanical build-and-upload procedure: toolchain, signing, build,
pre-upload verification, upload, version bumping, post-release monitoring. It assumes
you are starting on a clean machine.

For the **policy** side of the submission — Data safety answers, the background-location
declaration and demo video, App access instructions for the reviewer, permission
justifications, content rating — see [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md).
Both are required. A technically perfect AAB still gets rejected if the declarations are wrong.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Signing](#2-signing)
3. [Build](#3-build)
4. [Verify before upload](#4-verify-before-upload)
5. [Upload and rollout](#5-upload-and-rollout)
6. [Version bumping](#6-version-bumping)
7. [Post-release](#7-post-release)
8. [Appendix: what was verified, and how](#8-appendix-what-was-verified-and-how)

---

## 0. Before you start: the release-blocking checklist

These are settings in the repo that are correct for a *dev* build and wrong for a
*production* build. Every one of them will ship silently if you don't check.

| Check | Why it blocks | Verify with |
|---|---|---|
| `google-services.json` at the repo root | Without it, FCM is not configured and push notifications never arrive. `app.config.ts` prints a warning and builds anyway. | `ls google-services.json` — and watch the prebuild log for `not found - building without Firebase` |
| `EXPO_PUBLIC_RORK_API_BASE_URL` points at your **HTTPS** production origin | The default in `constants/config.ts` is `http://localhost:8080`. Worse, cleartext HTTP is blocked by default on API 28+ and this app declares no `usesCleartextTraffic`, so a plain-`http://` backend fails outright in release. | see [Environment variables](#31-environment-variables) |
| `EXPO_PUBLIC_WS_URL` / `EXPO_PUBLIC_WS_SOCKJS_URL` point at production (`wss://`) | Same as above — the STOMP socket silently never connects. | `constants/config.ts` |
| `versionCode` is higher than anything ever uploaded | Play permanently refuses a reused `versionCode`. | [§6](#6-version-bumping) |
| Signed with the upload key, not the debug key | Play rejects debug-signed artifacts outright. | [§4](#4-verify-before-upload) |

---

## 1. Prerequisites

You build on **your own machine**. Nothing here needs a CI runner or an Expo account.

### 1.1 Versions this project actually requires

These are read from the dependency tree in this repo, not from generic docs:

| Tool | Version | Where the requirement comes from |
|---|---|---|
| **Node.js** | **>= 20.19.4** | `node_modules/react-native/package.json` → `"engines": {"node": ">= 20.19.4"}`. Node 22 LTS is a good default. |
| **JDK** | **17** (17 is the minimum AGP 8.11 accepts; use 17 unless you have a reason not to) | Android Gradle Plugin **8.11.0**, pinned by `node_modules/react-native/gradle/libs.versions.toml` (`agp = "8.11.0"`) |
| **Gradle** | **8.14.3** — *do not install it* | `android/gradle/wrapper/gradle-wrapper.properties`. The wrapper downloads it on first build. Always use `./gradlew`, never a system `gradle`. |
| **Kotlin** | 2.1.20 | same version catalog (`kotlin = "2.1.20"`) — pulled automatically |
| **Android compileSdk / targetSdk** | **36** | `expo-build-properties` in `app.config.ts`, which writes `android.compileSdkVersion=36` / `android.targetSdkVersion=36` into `android/gradle.properties` |
| **Android minSdk** | **24** (Android 7.0) | same |
| **Android Build-Tools** | **36.0.0** | same (`android.buildToolsVersion=36.0.0`) |
| **Android NDK** | **27.1.12297006** | Expo's root-project plugin default. Only needed if a dependency compiles C++; also the easiest source of `llvm-readelf` for the 16 KB check. |

> **Play target-API requirement.** Verified on
> <https://developer.android.com/google/play/requirements/target-sdk> (fetched 2026-08-22):
> **from 31 August 2026, new apps and app updates must target Android 16 (API 36) or higher**,
> with extensions available to 1 November 2026. This repo already targets 36, so it is
> compliant — but **this threshold moves roughly every August**. Re-check that page before
> every submission, and watch for the warning banner on Play Console → Dashboard.

### 1.2 Install the JDK

Android Studio's bundled JDK ("JetBrains Runtime") is the least surprising option because
it is the JDK the Android tooling is tested against.

```bash
# macOS (Homebrew)
brew install --cask temurin@17
/usr/libexec/java_home -V          # list installed JDKs
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"

# Ubuntu / Debian
sudo apt install openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Verify
java -version                       # expect: openjdk version "17.x"
echo "$JAVA_HOME"
```

If you already have Android Studio, you can point Gradle at its JDK instead of installing
one, which avoids version drift:

```bash
# macOS
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
# Linux
export JAVA_HOME="$HOME/android-studio/jbr"
```

### 1.3 Install the Android SDK

Two options. **Android Studio** is easier and is what most people want; **command-line
tools only** is smaller and enough for a build box.

**Option A — Android Studio.** Install it, then in
*Settings → Languages & Frameworks → Android SDK → SDK Tools* tick:

- Android SDK Build-Tools **36.0.0**
- Android SDK Platform **36**
- Android SDK Platform-Tools (`adb`)
- Android SDK Command-line Tools (latest) — needed for `sdkmanager`
- NDK **27.1.12297006** (optional; only for the 16 KB alignment check and any dependency
  that compiles native code from source)

**Option B — command-line tools only.**

```bash
# Download "Command line tools only" from https://developer.android.com/studio#command-tools
mkdir -p "$HOME/Android/sdk/cmdline-tools"
unzip commandlinetools-*.zip -d "$HOME/Android/sdk/cmdline-tools"
mv "$HOME/Android/sdk/cmdline-tools/cmdline-tools" "$HOME/Android/sdk/cmdline-tools/latest"

export ANDROID_HOME="$HOME/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

sdkmanager --licenses          # accept all — the build fails on unaccepted licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
sdkmanager "ndk;27.1.12297006" # optional
```

### 1.4 Environment variables

Add to `~/.zshrc` / `~/.bashrc` and open a new shell:

```bash
export ANDROID_HOME="$HOME/Android/sdk"          # macOS default: $HOME/Library/Android/sdk
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"   # macOS; use the explicit path on Linux
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

`ANDROID_SDK_ROOT` is the older name for the same thing and is deprecated; set
`ANDROID_HOME`. Gradle also reads `android/local.properties` (`sdk.dir=...`), which
`expo prebuild` generates for you — but the env var is what the SDK tools themselves use.

Confirm:

```bash
node -v            # >= v20.19.4
java -version      # 17.x
echo $ANDROID_HOME # non-empty, and the directory exists
adb --version
sdkmanager --list_installed
```

### 1.5 bundletool (needed for §4)

```bash
# macOS
brew install bundletool

# Anywhere: download bundletool-all-<version>.jar from
# https://github.com/google/bundletool/releases and run it via java
export BUNDLETOOL_JAR="$HOME/tools/bundletool-all.jar"
java -jar "$BUNDLETOOL_JAR" version
```

### 1.6 Install project dependencies

```bash
cd /path/to/elcafe-courier-mobile-app
npm ci                # package-lock.json is committed; `npm ci` reproduces it exactly
npx expo-doctor       # optional but worth reading before a release
```

---

## 2. Signing

### 2.1 Play App Signing, in one paragraph

Since 2021 **every new app on Google Play must enroll in Play App Signing** — it is not
optional and there is no opt-out for a new app. Under it there are **two** keys:

- The **app signing key** — Google generates and holds it. It signs the APKs actually
  delivered to users. You never see it. If it were ever lost, every installed copy of the
  app would be orphaned; that is exactly the disaster Play App Signing exists to prevent.
- The **upload key** — *you* generate and hold it. It signs the AAB you upload. Play
  verifies your upload key, strips your signature, and re-signs with the app signing key.

The practical consequence, and the reason this scheme is good news: **losing your upload
key is recoverable.** You generate a new one, and request an upload key reset through Play
Console (Help → contact support; Google resets it, typically within a couple of business
days). You lose nothing but time. Losing an *app signing* key in the old pre-2021 world
was permanent and unrecoverable.

Two consequences worth internalising now, because they surprise people later:

1. **The certificate fingerprint of what users install is not your upload key's
   fingerprint.** Anything keyed to a signing certificate — Google Maps API key
   restrictions, Firebase SHA-1/SHA-256 registration, App Links / Digital Asset Links —
   must have the **app signing key** fingerprint registered, which you copy from
   Play Console → *Test and release → Setup → App integrity → App signing*. Register the
   upload key fingerprint too, so locally-installed test builds keep working.
2. Anything you sideload for testing (see [§4.5](#45-install-on-a-real-device)) is signed
   with your **upload** key, so it behaves like a different app to those fingerprint checks.

### 2.2 Generate the upload keystore

Run this once. Not in the repo directory — see [§2.3](#23-where-to-keep-it).

```bash
keytool -genkeypair -v \
  -keystore zbr-upload.keystore \
  -alias zbr-upload \
  -keyalg RSA -keysize 4096 \
  -sigalg SHA256withRSA \
  -validity 10000 \
  -storetype PKCS12 \
  -dname "CN=ZBR Courier, OU=Mobile, O=<your legal entity>, L=<city>, ST=<region>, C=UZ"
```

`keytool` will prompt for a keystore password, then a key password. Use a long random
password for each, generated by your password manager, and **store both in the password
manager immediately** — there is no way to recover them.

Why these parameters:

- `-keyalg RSA -keysize 4096` — Play requires RSA **2048 bits or more**; 4096 costs nothing
  and gives margin. (2048 is acceptable if you prefer.)
- `-validity 10000` — ~27 years. Play requires the certificate to remain valid past
  **22 October 2033**; 10000 days from today comfortably clears that. A key that expires
  is a key you can no longer upload with.
- `-storetype PKCS12` — the standard, portable format. If you omit it, modern `keytool`
  defaults to PKCS12 anyway but prints a migration warning; being explicit avoids the noise.
- `-sigalg SHA256withRSA` — explicit rather than relying on the default.

Verify what you produced, and **save the SHA-256 fingerprint** — you will compare it against
Play Console after the first upload:

```bash
keytool -list -v -keystore zbr-upload.keystore -alias zbr-upload
```

Expected shape of the output (this is a throwaway key generated while writing this doc,
purely to show the format):

```
Keystore type: PKCS12
Alias name: zbr-upload
Entry type: PrivateKeyEntry
Owner: CN=ZBR Courier, OU=Mobile, O=ZBR, L=Tashkent, ST=Tashkent, C=UZ
Valid from: Sat Aug 22 13:40:08 UTC 2026 until: Wed Jan 07 13:40:08 UTC 2054
Certificate fingerprints:
	 SHA1: 9B:11:63:42:...
	 SHA256: A8:36:AB:34:...
Signature algorithm name: SHA256withRSA
Subject Public Key Algorithm: 4096-bit RSA key
```

Note `until: 2054` — that is the `-validity 10000` working.

### 2.3 Where to keep it

**Never in this repository.** `.gitignore` already covers the file patterns
(verified — it contains `*.jks`, `*.keystore`, `*.p12`, `*.key`, `*.p8`, plus
`keystore.properties` and `google-services.json`), so an accidental `git add` of
`zbr-upload.keystore` would be ignored. Do not rely on that as your only defence:

- **Never put it under `android/`.** `expo prebuild --clean` *deletes that whole directory*
  before regenerating it. A keystore stored there is destroyed on the next build, without a
  prompt. This is the single most likely way to lose the upload key on this project.
- Keep it somewhere stable and backed up outside the repo, e.g. `~/keys/zbr/zbr-upload.keystore`.
- Store a copy plus **both passwords and the alias** in your password manager, and a second
  copy in a different place (encrypted archive, company vault). Treat it like a production
  credential, because it is one.

### 2.4 Wire it up via `~/.gradle/gradle.properties`

Put the credentials in your **user-level** Gradle properties file — outside the repo, so
they cannot be committed and are shared by every project you build.

```bash
mkdir -p ~/.gradle
```

Add to `~/.gradle/gradle.properties`:

```properties
# ZBR Courier upload signing. NEVER commit this file; it lives in $HOME, not the repo.
# The path MUST be absolute (see the note below).
ZBR_UPLOAD_STORE_FILE=/Users/you/keys/zbr/zbr-upload.keystore
ZBR_UPLOAD_STORE_PASSWORD=<keystore password>
ZBR_UPLOAD_KEY_ALIAS=zbr-upload
ZBR_UPLOAD_KEY_PASSWORD=<key password>
```

```bash
chmod 600 ~/.gradle/gradle.properties
```

> **The path must be absolute.** The generated Gradle code calls
> `storeFile file(ZBR_UPLOAD_STORE_FILE)`, and Gradle's `file()` resolves a *relative* path
> against the module directory — `android/app/` — which is regenerated and deleted by
> prebuild. An absolute path is the only correct answer.

Gradle properties from `~/.gradle/gradle.properties` are visible to the build as project
properties, which is what the signing config reads.

**Alternative: pass them on the command line.** Useful for a one-off build or a build box
where you'd rather not persist secrets to disk:

```bash
cd android
./gradlew :app:bundleRelease \
  -PZBR_UPLOAD_STORE_FILE="$HOME/keys/zbr/zbr-upload.keystore" \
  -PZBR_UPLOAD_STORE_PASSWORD="$ZBR_STORE_PASSWORD" \
  -PZBR_UPLOAD_KEY_ALIAS=zbr-upload \
  -PZBR_UPLOAD_KEY_PASSWORD="$ZBR_KEY_PASSWORD"
```

Be aware that command-line arguments are visible in `ps` output and shell history on a
shared machine. `~/.gradle/gradle.properties` with mode `600` is the better default.

### 2.5 The CNG problem — and how this repo solves it

Here is the nuance that catches everyone moving from EAS to local builds.

The React Native / Expo bare template generates `android/app/build.gradle` with the release
build type **signed by the debug key**:

```groovy
release {
    // Caution! In production, you need to generate your own keystore file.
    // see https://reactnative.dev/docs/signed-apk-android.
    signingConfig signingConfigs.debug
```

Every tutorial tells you to hand-edit that line. **On this project that advice is wrong.**
This repo uses Continuous Native Generation: `android/` is not committed (it is in
`.gitignore`), and `npx expo prebuild --clean` **deletes and regenerates it from scratch**.
Any hand edit to `android/app/build.gradle` survives exactly until the next prebuild, then
vanishes — and the next AAB you build is silently debug-signed. Play rejects it with
*"You uploaded an APK or Android App Bundle that was signed in debug mode"*, and if you're
unlucky you don't notice until you've burned a `versionCode`.

The durable options are:

| Approach | Verdict |
|---|---|
| Hand-edit `android/app/build.gradle` | ❌ Lost on every `prebuild`. Never do this here. |
| Commit `android/` and stop using prebuild | ❌ Abandons CNG. The native project goes stale against `app.config.ts` and every SDK upgrade becomes a manual merge. |
| `expo-build-properties` | ❌ Can't do it. That plugin exposes SDK versions, packaging and proguard flags — it has **no** signing-config option. It is already used here for `compileSdkVersion`/`targetSdkVersion`/`minSdkVersion`/`buildToolsVersion`, and that is all it can do. |
| **A local Expo config plugin that patches `build.gradle` during prebuild** | ✅ **What this repo does.** The patch is code, it re-applies on every prebuild, and it is reviewable in git. |

**This repo already implements the recommended approach.** `plugins/withAndroidReleaseSigning.js`
is listed **last** in the `plugins` array in `app.config.ts` (it must stay last — it rewrites
`android/app/build.gradle` after the template has been written). It uses Expo's
`withAppBuildGradle` mod to:

1. insert a `release` entry into `signingConfigs { ... }`, and
2. replace the template's `signingConfig signingConfigs.debug` with `signingConfig signingConfigs.release`.

It throws a build-time error if the Expo template ever changes shape, rather than silently
producing a debug-signed bundle.

**You do not need to write or edit anything for signing to work.** After `expo prebuild`,
`android/app/build.gradle` contains exactly this — verified by running prebuild against
this repo:

```groovy
    signingConfigs {
        release {
            if (project.hasProperty('ZBR_UPLOAD_STORE_FILE')) {
                storeFile file(ZBR_UPLOAD_STORE_FILE)
                storePassword ZBR_UPLOAD_STORE_PASSWORD
                keyAlias ZBR_UPLOAD_KEY_ALIAS
                keyPassword ZBR_UPLOAD_KEY_PASSWORD
            } else {
                logger.warn('[ZBR] ZBR_UPLOAD_STORE_FILE is not set - the release build will be signed with the DEBUG keystore. Google Play will reject this artifact.')
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {
            storeFile file('debug.keystore')
            ...
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Signed by withAndroidReleaseSigning: reads ZBR_UPLOAD_* Gradle properties.
            signingConfig signingConfigs.release
            ...
        }
    }
```

Note the fallback branch: if the `ZBR_UPLOAD_*` properties are missing, the build
**still succeeds** but is debug-signed, and prints:

```
[ZBR] ZBR_UPLOAD_STORE_FILE is not set - the release build will be signed with the DEBUG keystore. Google Play will reject this artifact.
```

That is a deliberate trade-off: it keeps `./gradlew assembleRelease` usable for a
performance smoke test without credentials. **It also means a missing property does not
fail your release build** — it just produces an unusable artifact. This is precisely why
[§4](#4-verify-before-upload) checks the signature before you upload. Do not skip it.

---

## 3. Build

### 3.1 Environment variables

The app reads `EXPO_PUBLIC_*` variables. These are **inlined into the JS bundle at build
time**, not read at runtime — so they must be set in the shell that runs the build, and
changing one requires a rebuild. They are also **not secret**: anything prefixed
`EXPO_PUBLIC_` is readable by anyone who unzips your APK. Never put an API secret there.

The variables this app reads (`constants/config.ts`, `services/pushNotification.ts`):

| Variable | Fallback if unset | Consequence of leaving it unset in a release build |
|---|---|---|
| `EXPO_PUBLIC_RORK_API_BASE_URL` | `http://localhost:8080` | Every API call fails. Cleartext `http://` is also blocked on API 28+. |
| `EXPO_PUBLIC_WS_URL` | derived from the base URL | STOMP WebSocket never connects — no live order offers. |
| `EXPO_PUBLIC_WS_SOCKJS_URL` | derived from the base URL | SockJS fallback never connects. |
| `EXPO_PUBLIC_PROJECT_ID` | `undefined` | Passed to the push-token call. |

Create a `.env` file at the repo root (Expo loads it automatically; `.env*.local` is
gitignored, and you should keep production values out of git entirely):

```bash
# .env — production values. [ACTION REQUIRED: fill in your real production origins.]
EXPO_PUBLIC_RORK_API_BASE_URL=https://api.example.com
EXPO_PUBLIC_WS_URL=wss://api.example.com/ws
EXPO_PUBLIC_WS_SOCKJS_URL=https://api.example.com/ws-sockjs
```

Or export them inline for a single build:

```bash
export EXPO_PUBLIC_RORK_API_BASE_URL=https://api.example.com
```

Confirm what actually got baked in **after** building, by grepping the bundle:

```bash
unzip -p android/app/build/outputs/bundle/release/app-release.aab \
  base/assets/index.android.bundle | grep -o 'https://[a-z0-9.-]*' | sort -u | head
```

If you see `localhost` in that output, stop and rebuild with the right environment.

### 3.2 Place `google-services.json`

Push uses **native FCM registration tokens** (the backend sends via Firebase Admin with its
own service-account key), so the Android app needs the Firebase client config.

**[ACTION REQUIRED:** download `google-services.json` from the Firebase console for the
Android app with package name `app.zbr.courier`, and place it at the **repo root**:
`/path/to/elcafe-courier-mobile-app/google-services.json`. It is gitignored — supply it out
of band on each machine that builds. **]**

`app.config.ts` wires it up only if the file exists, so a missing file does not break
`expo prebuild`; it prints a warning instead:

```
[app.config] ./google-services.json not found - building without Firebase. Push notifications will NOT work in this build.
```

**Watch for that line in the prebuild output.** If you see it during a release build, stop.

You can override the location with `GOOGLE_SERVICES_JSON=/abs/path/google-services.json`.

### 3.3 Generate the native project

```bash
cd /path/to/elcafe-courier-mobile-app
npx expo prebuild --platform android --clean
```

What `--clean` does: deletes `android/` entirely and regenerates it from `app.config.ts`.
**Always use it for a release build.** Without it, prebuild merges into an existing
directory and stale state (an old permission, a previous plugin's edit) can survive.

Sanity-check the result before building:

```bash
# versionCode / versionName that will be stamped into the AAB
grep -E "versionCode|versionName" android/app/build.gradle

# signing wired correctly (must say signingConfigs.release, NOT signingConfigs.debug)
grep -A1 "^        release {" android/app/build.gradle | head

# SDK levels resolved from expo-build-properties
grep -E "^android\." android/gradle.properties
```

Expected (verified against this repo at version 1.0.0):

```
        versionCode 1
        versionName "1.0.0"
android.minSdkVersion=24
android.compileSdkVersion=36
android.targetSdkVersion=36
android.buildToolsVersion=36.0.0
```

### 3.4 Build the AAB

```bash
cd android
./gradlew :app:bundleRelease
```

First run downloads Gradle 8.14.3 and the whole dependency graph — expect 10–20 minutes and
a few GB. Later builds are minutes.

The result:

```
android/app/build/outputs/bundle/release/app-release.aab
```

There is also a shortcut that does prebuild + bundle in one step (already defined in
`package.json`):

```bash
npm run build:aab
```

Useful flags:

```bash
./gradlew :app:bundleRelease --stacktrace     # full stack on failure
./gradlew :app:bundleRelease --info           # verbose; where the [ZBR] signing warning shows up
./gradlew clean                               # clear build outputs without re-running prebuild
```

If Gradle runs out of memory (RN builds are heavy), raise the heap in
`android/gradle.properties` — but remember that file is **regenerated by prebuild**, so a
lasting change belongs in `~/.gradle/gradle.properties` instead:

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

(The generated default in this project is `-Xmx2048m -XX:MaxMetaspaceSize=512m`.)

### 3.5 Build a release APK for local device testing

An AAB is not installable. To put a release build on a phone directly:

```bash
cd android
./gradlew :app:assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk

adb install -r android/app/build/outputs/apk/release/app-release.apk
```

This is a real release build — minified, release-signed, no Metro dev server — so it is the
right way to check things that only break in release: ProGuard/R8 stripping, missing
production env vars, notification icons, and startup performance.

**Why the store gets the AAB and not the APK.** Google Play has required the Android App
Bundle for all new apps since August 2021 — you cannot upload an APK for a new app. An AAB
is not an installable package; it is the compiled *inputs*, from which Play generates and
signs an optimised APK per device: only that device's ABI, screen density, and language
resources. A universal APK carries all four ABIs and every density for every device, so it
is substantially larger to download. It is also what enables Play App Signing, staged
rollouts, and Play Feature Delivery. Use `assembleRelease` for your own testing; upload
`bundleRelease` output.

---

## 4. Verify before upload

**Do this every time.** A failed upload is cheap; a bad *accepted* upload burns a
`versionCode` you can never reuse, and a bad *rolled-out* release reaches real couriers.

A script performs all the automated checks in one pass:

```bash
scripts/verify-aab.sh
# or against a specific file:
scripts/verify-aab.sh android/app/build/outputs/bundle/release/app-release.aab
```

It exits non-zero if anything is wrong and prints `DO NOT UPLOAD`. It needs `BUNDLETOOL`
or `BUNDLETOOL_JAR` set for the manifest checks (see [§1.5](#15-bundletool-needed-for-4)).
The individual checks are below, so you can run them by hand or understand what the script
is telling you.

### 4.1 Verify the signature

An AAB carries a **JAR signature**, not an APK Signature Scheme v2/v3 block — so
`apksigner verify` does **not** work on a bundle. Use `jarsigner`:

```bash
jarsigner -verify -verbose:summary -certs \
  android/app/build/outputs/bundle/release/app-release.aab
```

You want to see `jar verified.`. Two failure modes to look for:

- `jar is unsigned.` — the release build type applied no signing config at all.
- The certificate owner reads `CN=Android Debug, O=Android, C=US` — the `ZBR_UPLOAD_*`
  properties were not visible to Gradle and the fallback branch fired. **Play will reject
  this.** Fix `~/.gradle/gradle.properties` and rebuild.

Print the signer certificate and compare the SHA-256 with your keystore:

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
keytool -list -v -keystore ~/keys/zbr/zbr-upload.keystore -alias zbr-upload
```

The SHA-256 from both commands must be identical, and must match Play Console →
*Test and release → Setup → App integrity → App signing → Upload key certificate*.

### 4.2 Verify versionCode and versionName

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab

bundletool dump manifest --bundle="$AAB" --xpath=/manifest/@android:versionCode
bundletool dump manifest --bundle="$AAB" --xpath=/manifest/@android:versionName
bundletool dump manifest --bundle="$AAB" --xpath=/manifest/@package
```

Expect `1`, `1.0.0`, `app.zbr.courier` for the first release.

The `versionCode` must be **strictly greater than every code you have ever uploaded to any
track** — internal, closed, open, or production — including releases you later deleted or
halted. Play tracks used codes permanently.

### 4.3 Verify the merged manifest permissions

The manifest you ship is a *merge* of your config and every dependency's library manifest.
A new dependency can quietly add a permission that then shows on your store listing and may
require a Data safety or declaration change.

```bash
bundletool dump manifest --bundle="$AAB" | grep uses-permission
```

Verified output for this project, straight from the generated manifest:

```
android.permission.ACCESS_BACKGROUND_LOCATION
android.permission.ACCESS_COARSE_LOCATION
android.permission.ACCESS_FINE_LOCATION
android.permission.FOREGROUND_SERVICE
android.permission.FOREGROUND_SERVICE_LOCATION
android.permission.INTERNET
android.permission.MODIFY_AUDIO_SETTINGS
android.permission.POST_NOTIFICATIONS
android.permission.READ_EXTERNAL_STORAGE
android.permission.VIBRATE
android.permission.WRITE_EXTERNAL_STORAGE
```

And these four, listed in `android.blockedPermissions` in `app.config.ts`, must **not**
appear (they are stripped with `tools:node="remove"`):

```
android.permission.RECORD_AUDIO
android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK
android.permission.SCHEDULE_EXACT_ALARM
android.permission.SYSTEM_ALERT_WINDOW
```

`scripts/verify-aab.sh` diffs both lists automatically and warns on anything new.

You can also read the pre-build merged manifest without bundletool — the same file the
merge produces:

```bash
cat android/app/src/main/AndroidManifest.xml
# and the true post-merge result, after a build:
cat android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml
```

> **ACCESS_BACKGROUND_LOCATION is the highest-risk line in that list.** Play requires a
> background-location declaration form, a prominent in-app disclosure shown *before* the
> permission request, and a demo video — and rejects apps that declare it without a
> qualifying, shipping feature. See §5 of
> [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md).

### 4.4 Verify 16 KB page-size alignment

Google's requirement, verified on
<https://developer.android.com/guide/practices/page-sizes> (fetched 2026-08-22):

> "all apps targeting Android 15 (API level 35) and higher must support 16 KB memory page
> sizes on 64-bit devices on Google Play. Starting **February 1, 2027**, if your app updates
> don't support 16 KB memory page sizes, you won't be able to release these updates."

This app targets 36, so it is in scope. **Re-check that page before each submission** — the
enforcement date has moved before.

Two things have to be true. First, native libs must be stored **uncompressed** so they can
be mapped directly from the APK. That comes from `expo.useLegacyPackaging=false`, which is
the SDK 54 default and is present in the generated `android/gradle.properties` (verified).
Second, every `LOAD` segment of every bundled `.so` must be aligned to at least
`0x4000` (16384 bytes).

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab

rm -rf /tmp/aab && mkdir -p /tmp/aab
unzip -q -o "$AAB" 'base/lib/*' -d /tmp/aab

READELF="$ANDROID_HOME/ndk/27.1.12297006/toolchains/llvm/prebuilt/$(uname -s | tr 'A-Z' 'a-z')-x86_64/bin/llvm-readelf"

for so in $(find /tmp/aab -name '*.so'); do
  echo "== $so"
  "$READELF" -lW "$so" | awk '$1=="LOAD" {print "   align:", $NF}'
done
```

Every printed alignment must be `0x4000` or larger. `0x1000` (4096) **fails**.

`scripts/verify-aab.sh` does this automatically and, if no `llvm-readelf` is available,
falls back to a built-in Python ELF program-header reader that reads the same `p_align`
field — so the check works without the NDK installed. Both readers were cross-checked
against `readelf` on known-good (`0x4000`) and known-bad (`0x1000`) libraries while writing
this doc; they agree.

If a library fails, the offending dependency is shipping a 4 KB-aligned prebuilt. Update it;
if there is no updated version, it cannot ship once enforcement begins.

### 4.5 Install on a real device

The strongest pre-upload check: generate exactly the APKs Play would deliver to your device,
and install them.

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab

bundletool build-apks \
  --bundle="$AAB" \
  --output=/tmp/zbr-release.apks \
  --ks="$HOME/keys/zbr/zbr-upload.keystore" \
  --ks-key-alias=zbr-upload \
  --ks-pass=pass:"$ZBR_STORE_PASSWORD" \
  --key-pass=pass:"$ZBR_KEY_PASSWORD" \
  --connected-device

bundletool install-apks --apks=/tmp/zbr-release.apks
```

`--connected-device` builds only the splits your attached device needs — the closest
possible match to what Play delivers. Drop it and add `--mode=universal` for a single fat
APK you can sideload anywhere.

Verify the generated APK's signature (here `apksigner` *is* the right tool, because these
are APKs):

```bash
unzip -o /tmp/zbr-release.apks -d /tmp/zbr-apks
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs --verbose \
  /tmp/zbr-apks/splits/base-master.apk
```

Remember these APKs carry your **upload** key, not the app signing key Play will use —
so a Maps API key or Firebase SHA restriction that only lists the production fingerprint
will fail here. Register both fingerprints.

Smoke-test on the device, at minimum:

- phone-OTP login **and** email/password login
- the courier verification-pending screen for an unverified account
- the location disclosure modal appears **before** the first system location prompt
- foreground location updates while on shift
- a push notification for a new order offer actually arrives (this is the one that fails
  silently if `google-services.json` was missing)
- in-app account deletion
- all three languages (en / ru / uz)

---

## 5. Upload and rollout

### 5.1 Create the app (first time only)

1. Play Console → **All apps → Create app**.
2. App name `ZBR Courier`, default language, type **App**, **Free**.
3. Accept the developer program policies and US export laws declarations.
4. Work through **Dashboard → "Set up your app"**. Store listing, Data safety, content
   rating, target audience, App access, and the background-location declaration all live
   here — the answers are in [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md).
5. Play App Signing is enabled automatically for new apps; the first AAB you upload
   establishes your upload key.

Note the app must be created with the **same package name** as the bundle:
`app.zbr.courier`. The package name is permanent — it cannot be changed after the app is
created, ever.

### 5.2 Internal testing first

Always. It has no review wait in practice, it accepts up to 100 testers, and it is where you
find out that push doesn't work or the API URL is wrong — before anyone official looks at it.

1. **Test and release → Testing → Internal testing → Create new release**.
2. Upload `app-release.aab`.
3. On the **first** upload, Play shows the upload key certificate it derived. Compare its
   SHA-256 with `keytool -list -v` from [§2.2](#22-generate-the-upload-keystore).
4. Write release notes (they are required, per language you list).
5. **Save → Review release → Start rollout to Internal testing.**
6. Add testers by email list, share the opt-in link, install from Play, retest everything
   from [§4.5](#45-install-on-a-real-device) — this time signed with the real app signing key.

Read the **pre-launch report** (Release → Pre-launch report) after the first upload. Google
runs the app on physical devices and reports crashes, ANRs, accessibility problems and
insecure-network findings. It catches things emulator testing does not.

### 5.3 Promote through the tracks

Tracks form a ladder. You can promote a release from one to the next without re-uploading
the AAB — **Release → Promote release** — which is the point: the exact bytes you tested
are the bytes that ship.

| Track | Audience | What it is for |
|---|---|---|
| **Internal** | up to 100 named testers | Immediate. Your own smoke testing. |
| **Closed** | named testers or Google Groups | Real couriers on real routes. **This is where the first Google review happens for a new app** — expect a wait, often days, occasionally longer for an app declaring background location. |
| **Open** | anyone who opts in | Optional. Useful for wider load testing; skippable for an internal-workforce app. |
| **Production** | everyone | Staged rollout. |

For a courier app with a known user base, Internal → Closed → Production is the right path.
Budget real time for the closed-track review: background location plus a fresh developer
account is the slowest combination Google has.

### 5.4 Production and staged rollout

Never ship a first production release at 100%. Use a **staged rollout** so a crash reaches a
small fraction of couriers, not all of them.

1. **Test and release → Production → Create new release** (or promote from Closed).
2. Set **Rollout percentage**.
3. A sane schedule, holding a day at each step and watching vitals:

   | Step | % | Hold |
   |---|---|---|
   | 1 | 5% | 24h |
   | 2 | 10% | 24h |
   | 3 | 20% | 24h |
   | 4 | 50% | 24h |
   | 5 | 100% | — |

4. Increase with **Release → Production → the active release → Update rollout**.

If something is wrong mid-rollout, **halt the rollout** immediately (same screen). Halting
stops new users receiving the update; it does **not** roll back devices already updated —
there is no un-update on Android. The only real fix is to ship a corrected higher
`versionCode` and roll it out. That asymmetry is exactly why you start at 5%.

### 5.5 If a release is rejected

Rejection is normal, especially on a first submission with background location. The loop:

1. **Read the rejection email and the Policy status page carefully.** Play names the exact
   policy and usually the exact screen or declaration at fault.
2. **Fix the actual cause.** For this app the usual suspects are: the background-location
   declaration not matching what the app does, a missing or unconvincing prominent
   disclosure, Data safety answers that contradict the permissions in the manifest, or App
   access instructions that don't let a reviewer past the verification-pending screen
   (a reviewer cannot get an admin to approve their account — you must give them a
   pre-verified demo account).
3. **Bump `versionCode`** — see [§6](#6-version-bumping). This is not optional: a rejected
   AAB has consumed its `versionCode` forever. Even if you changed nothing but a Play
   Console text field, a *new upload* needs a new code.
4. Rebuild, re-verify ([§4](#4-verify-before-upload)), re-upload, resubmit.
5. If you believe the rejection is wrong, appeal via the link in the email rather than
   resubmitting unchanged — repeated identical resubmissions risk enforcement against the
   developer account.

Declaration-only changes (Data safety, content rating, App access) usually do **not**
require a new upload — you edit them in Console and resubmit. Only ship a new AAB when the
*app* has to change.

---

## 6. Version bumping

Without EAS there is no `autoIncrement`. Three fields in `app.config.ts` must move together:

| Field | Meaning | Rule |
|---|---|---|
| `version` | user-visible version name (`1.0.0`) | Semantic; shown on the store listing. |
| `android.versionCode` | integer Play orders releases by | **Must strictly increase. Never reusable.** |
| `ios.buildNumber` | iOS equivalent | Bumped alongside, to stop the platforms drifting. |

Forgetting `versionCode` is the most common local-release mistake. Play refuses the upload
with *"Version code 1 has already been used"* and the only fix is bump-and-rebuild.

### 6.1 Use the script

```bash
node scripts/bump-version.mjs             # build bump: versionCode +1, buildNumber +1
node scripts/bump-version.mjs 1.1.0       # release bump: set version, then +1 both codes
node scripts/bump-version.mjs --dry-run   # show what would change, write nothing
```

Real output:

```
$ node scripts/bump-version.mjs --dry-run
bump-version: DRY RUN, nothing written to /path/to/app.config.ts
  version           1.0.0  ->  1.0.0
  android.versionCode 1  ->  2
  ios.buildNumber     1  ->  2
```

The script refuses to run rather than half-applying a bump: it fails if any of the three
fields is missing, if a field matches ambiguously, if the version isn't `MAJOR.MINOR.PATCH`,
or if you try to move the version backwards. It re-reads its own output to confirm all
three landed.

### 6.2 Confirm and rebuild

```bash
npx expo config --type prebuild --json \
  | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(c.version, c.android.versionCode, c.ios.buildNumber)"
# -> 1.1.0 3 3

npx expo prebuild --platform android --clean
cd android && ./gradlew :app:bundleRelease
grep -E "versionCode|versionName" app/build.gradle   # confirm it reached the native project
```

### 6.3 Doing it by hand

If you'd rather edit directly, change all three in `app.config.ts`:

```ts
version: '1.1.0',            // top level
  android: { versionCode: 3, ... }
  ios:     { buildNumber: '3', ... }
```

Then run the `expo config` confirmation above. Do not edit `android/app/build.gradle` —
prebuild overwrites it from `app.config.ts`.

> **`app.json` is dead weight — do not edit it.** This repo contains both `app.json` and
> `app.config.ts`. Because `app.config.ts` exports a static object rather than a function,
> it **replaces** `app.json` entirely; `app.json` is stale (it still has the old `rork.com`
> router origin and a `SCHEDULE_EXACT_ALARM` permission) and none of it reaches the build.
> Verified: `npx expo config --type prebuild` resolves to `app.config.ts`'s values, and
> `SCHEDULE_EXACT_ALARM` does not appear in the resolved permission list. Bumping a version
> in `app.json` changes nothing and will waste an afternoon.

---

## 7. Post-release

### 7.1 Android vitals

**Play Console → Quality → Android vitals.** Play assesses your app against *bad behavior
thresholds* using the trailing 28 days of data. Verified on
<https://developer.android.com/topic/performance/vitals> (fetched 2026-08-22):

| Metric | Overall threshold | Per phone model |
|---|---|---|
| User-perceived **crash** rate | **1.09%** | 8% |
| User-perceived **ANR** rate | **0.47%** | 8% |

"User-perceived" means the app was in the foreground or otherwise visible to the user —
a background crash the user never sees does not count against you.

Exceeding a threshold means Play *"may reduce the visibility of your title"* and *"may also
show users a warning on your store listing"*. Vitals also flags **emerging issues** —
problems affecting devices for over 7 days — giving you roughly 21 days to fix them before
visibility is affected.

**Re-check those numbers before relying on them**; Google adjusts them. The page above is
the source of truth, and Play Console shows your app's current position against them
directly.

What to watch in the first week, specifically for this app:

- **ANRs** — the most likely source here is blocking work on the main thread around the
  STOMP WebSocket reconnect and the location update loop. ANRs are far harder to reproduce
  locally than crashes; vitals is where you find them.
- **Crash-free rate by Android version** — background-location and foreground-service
  behaviour differs sharply across API levels, and minSdk here is 24, so you have a wide
  range in the field.
- **Excessive wakeups / stuck partial wake locks** — a location-tracking courier app is a
  prime candidate, and battery-drain flags hurt the listing.
- **Permission denial rates** — a high background-location denial rate is a signal your
  disclosure copy isn't working.

Also read **Release → Pre-launch report** on every release, and check **Policy status** for
any new declaration Google starts requiring.

### 7.2 There are no over-the-air fixes

`expo-updates` is **not** installed and `updates.enabled` is `false` in `app.config.ts`
(verified in the generated manifest: `expo.modules.updates.ENABLED = false`). This is a
deliberate consequence of the local-build model.

It means **every change ships through the store**, including a one-line JS typo fix:

```
edit code
  -> bump versionCode (§6)
  -> prebuild + bundleRelease (§3)
  -> verify (§4)
  -> upload, submit, wait for review
  -> staged rollout (§5.4)
  -> users update (whenever their device gets around to it)
```

Realistically that is hours-to-days before the fix is even *available*, then longer before
couriers actually have it — Play auto-update is not immediate and some users have it off.

Plan around it:

- Treat the 5% staged rollout as your real safety net, not a formality.
- Prefer **server-side** fixes wherever a choice exists. The backend can change messages,
  thresholds, feature gates and endpoints without a store cycle; the app cannot.
- Consider a server-driven "minimum supported app version" check so you can *tell* couriers
  to update when a client fix is mandatory.
- If OTA JS updates become genuinely necessary, adding `expo-updates` with a self-hosted
  manifest is possible without EAS — but it is a real change to the release model, and
  Play's policy limits what may be changed OTA (no changing the app's core purpose or
  bypassing review).

---

## 8. Appendix: what was verified, and how

Everything in this section was observed by running the command shown against this repo, on
2026-08-22. Anything that needs the Android SDK could **not** be run in the authoring
environment and is marked as such — those commands' syntax is correct but their output is
not reproduced here.

| Fact | Command | Result |
|---|---|---|
| Node engine requirement | `node -e "console.log(require('react-native/package.json').engines)"` | `{"node":">= 20.19.4"}` |
| RN / Expo versions | `node -e "..."` on each `package.json` | `react-native 0.81.5`, `expo 54.0.37` |
| AGP / Kotlin / NDK pins | `cat node_modules/react-native/gradle/libs.versions.toml` | `agp = "8.11.0"`, `kotlin = "2.1.20"`, `ndkVersion = "27.1.12297006"` |
| Gradle wrapper version | `cat android/gradle/wrapper/gradle-wrapper.properties` | `gradle-8.14.3-bin.zip` |
| Prebuild succeeds | `npx expo prebuild --platform android --clean --no-install` | `✔ Finished prebuild` |
| SDK levels reach Gradle | `grep '^android\.' android/gradle.properties` | `minSdkVersion=24`, `compileSdkVersion=36`, `targetSdkVersion=36`, `buildToolsVersion=36.0.0` |
| Signing plugin patches the template | `grep -A12 'signingConfigs {' android/app/build.gradle` | `release { if (project.hasProperty('ZBR_UPLOAD_STORE_FILE')) ... }` present; release build type reads `signingConfig signingConfigs.release` |
| 16 KB packaging flag | `grep useLegacyPackaging android/gradle.properties` | `expo.useLegacyPackaging=false` |
| Merged manifest permissions | `cat android/app/src/main/AndroidManifest.xml` | the 11 permissions listed in §4.3; the 4 blocked ones carry `tools:node="remove"` |
| No cleartext opt-in | same file | no `android:usesCleartextTraffic` — so plain `http://` is blocked at API 28+ |
| Updates disabled | same file | `expo.modules.updates.ENABLED` = `false` |
| Version fields stamped | `grep -E 'versionCode\|versionName' android/app/build.gradle` | `versionCode 1`, `versionName "1.0.0"` |
| `app.json` is ignored | `npx expo config --type prebuild --json` | resolves `app.config.ts` values only; `SCHEDULE_EXACT_ALARM` (present in `app.json`) is absent |
| `.gitignore` covers keystores | `cat .gitignore` | `*.jks`, `*.keystore`, `*.p12`, `*.key`, `*.p8`, `keystore.properties`, `google-services.json`, `/android`, `/ios` |
| keytool command works | the exact command in §2.2 | keystore created; `keytool -list -v` shows PKCS12, 4096-bit RSA, SHA256withRSA, valid until 2054 |
| `jarsigner`/`keytool -printcert -jarfile` verify a bundle | run against a signed test bundle | `jar verified`; SHA-256 printed and matched the keystore |
| 16 KB alignment check detects both cases | `scripts/verify-aab.sh` against ELF libs of known alignment | correctly failed a `0x1000` library and passed a `0x4000` one; the NDK reader and the built-in Python reader agree with `readelf` |
| `scripts/bump-version.mjs` | dry-run, build bump, release bump, and all four error paths | correct in every case; bumped config re-resolves through `expo config` as `1.1.0 / 3 / 3` |

**Not runnable in the authoring environment** (no Android SDK was installed there), so the
syntax is given but the output is not: `./gradlew :app:bundleRelease`,
`./gradlew :app:assembleRelease`, all `bundletool` invocations, `apksigner`, `adb`,
`sdkmanager`.

### Policy sources, with fetch dates

Policy deadlines move. Each of these was read on **2026-08-22**; re-read them before every
submission rather than trusting this document.

| Requirement | Source | What it said |
|---|---|---|
| Target API level | <https://developer.android.com/google/play/requirements/target-sdk> | From **31 Aug 2026**, new apps and updates must target **API 36+**; extensions available to 1 Nov 2026 |
| 16 KB page sizes | <https://developer.android.com/guide/practices/page-sizes> | Required for apps targeting API 35+; from **1 Feb 2027** non-compliant updates cannot be released |
| Vitals thresholds | <https://developer.android.com/topic/performance/vitals> | Crash **1.09%**, ANR **0.47%** (overall); 8% per phone model; assessed over 28 days |

Also worth bookmarking: Play Console → **Policy → Policy status**, which lists everything
Google currently wants from *this specific app*, and is more reliable than any general doc.

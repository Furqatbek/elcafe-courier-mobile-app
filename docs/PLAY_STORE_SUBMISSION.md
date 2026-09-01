# ZBR Courier — Google Play Production Submission Pack

**App:** ZBR Courier · **Package / applicationId:** `app.zbr.courier` · **Stack:** Expo SDK 54 / React Native 0.81.5 / expo-router
**Distribution model:** local `npx expo prebuild` + Gradle → AAB uploaded **manually** to Play Console. EAS is not used anywhere in this repo — there is no `eas.json`, no `projectId`, and no Expo push service.
**Purpose:** every Play Console form you must fill, answered for *this* app, derived from *this* codebase, so you can copy answers in without guessing.

> **Start with [`PLAY_STORE_INDEX.md`](./PLAY_STORE_INDEX.md), not this file.** The index carries the
> developer-account gating that can add three or more weeks to your timeline, and the running order
> for everything below. This document is the reference you open once the index sends you here.

---

## 0. How to read this document

Every factual claim below carries a `file:line` citation into this repo, and every claim was
re-verified against the working tree on **2026-08-22** by running the commands shown.

| Marker | Meaning |
|---|---|
| `[ACTION REQUIRED: …]` | A genuine human decision or secret. You must supply it; nothing in the code can. |
| `[BLOCKER]` | Will get the app rejected, blocked, or visibly broken in review. Fix before uploading. |
| `[RE-VERIFY]` | Depends on a file **this document does not own** and that other work is actively touching. Re-run the stated command before you submit. |

**Where native config comes from.** `app.config.ts` is the **sole** config source.
**There is no `app.json` in this repository** — verified:

```
$ ls app.json
ls: cannot access 'app.json': No such file or directory
```

and confirmed by the resolved config, whose `_internal.staticConfigPath` is an empty object:

```json
"_internal": {
  "dynamicConfigPath": "/home/user/elcafe-courier-mobile-app/app.config.ts",
  "staticConfigPath": {}
}
```

Any document, checklist, or note telling you to "delete `app.json`" is describing a tree that no
longer exists. Everywhere below, "the config" means `app.config.ts`, and the authoritative
permission list is the output of `npx expo config --type prebuild --json`, not either file read by eye.

**Policy dates move. Re-check; do not trust this file for deadlines.**

- Location permissions policy (background location + the demo video) — <https://support.google.com/googleplay/android-developer/answer/9799150>
- Data safety form — <https://support.google.com/googleplay/android-developer/answer/10787469>
- Target API level requirement — <https://developer.android.com/google/play/requirements/target-sdk>
- Production access for new personal accounts — <https://support.google.com/googleplay/android-developer/answer/14151465>

Play Console itself is authoritative: **Policy → App content** lists every declaration your build
actually triggers. If Console asks for a declaration this document does not mention, Console is right.

---

## 1. Verified facts about this build

Evidence is quoted from the current tree, not summarised.

### 1.1 Target API level, min SDK, architectures

`expo-build-properties` is **not installed** in this tree:

```
$ ls -d node_modules/expo-build-properties
ls: cannot access 'node_modules/expo-build-properties': No such file or directory
$ grep -c expo-build-properties package.json
0
```

so the SDK levels are **inherited from React Native's Gradle version catalog**, not pinned in
`app.config.ts`:

```
$ grep -n "Sdk" node_modules/react-native/gradle/libs.versions.toml
3:minSdk = "24"
4:targetSdk = "36"
5:compileSdk = "36"
```

Expo's root-project plugin consumes that catalog (falling back to 35 only if the catalog is absent) —
`node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt`.

**So a clean prebuild targets API 36 (Android 16), minSdk 24, and is ahead of the current Play
requirement.** Because the value is *inherited* rather than pinned, it moves when React Native moves —
which is convenient now but means an RN downgrade could silently drop you below the required level.
Check the resolved value after every dependency bump:

```bash
grep -n "targetSdk" node_modules/react-native/gradle/libs.versions.toml
```

*How to re-check the requirement:* Play Console refuses the upload with an explicit error naming the
required level, so an upload attempt is itself a valid check.

### 1.2 16 KB page size

Play requires apps targeting Android 15+ to support 16 KB memory pages. React Native 0.81 and Expo
SDK 54 ship 16 KB-aligned native libraries by default, so a stock prebuild should pass — **verify your
actual AAB rather than trusting that**, because a stray third-party `.so` will fail you:

```bash
cd /home/user/elcafe-courier-mobile-app
unzip -o -q android/app/build/outputs/bundle/release/app-release.aab -d /tmp/aab-check
find /tmp/aab-check -name '*.so' -print0 | xargs -0 -I{} sh -c \
  'echo "== {}"; $ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf -l "{}" | grep -A1 LOAD | head -4'
# Every LOAD segment Align must be 0x4000 (16384) or larger. 0x1000 (4096) fails.
```

Play Console also surfaces this as a pre-launch warning on the release page.

### 1.3 Third-party SDKs that actually ship — and why `package.json` cannot tell you

**Do not derive Data safety answers from a `package.json` grep.** `package.json` lists JavaScript
dependencies; the SDKs that matter to Play arrive as **native Gradle dependencies** declared inside
those packages, and a grep of `package.json` cannot see them. Play's own guidance is explicit that
your declarations must cover "user data transmitted off device from your app by libraries and/or
SDKs used in your app, irrespective of whether data is transmitted to you or a third-party server"
(<https://support.google.com/googleplay/android-developer/answer/10787469>).

Re-derive the real list, and re-run this on every dependency bump:

```
$ grep -rhoE "com\.google\.(android\.gms|firebase|maps)[a-zA-Z0-9.:_-]*" node_modules/*/android/build.gradle | sort -u
com.google.android.gms:play-services-base:
com.google.android.gms:play-services-code-scanner:16.1.0
com.google.android.gms:play-services-location:21.0.1
com.google.android.gms:play-services-maps:
com.google.firebase:firebase-messaging:24.0.1
com.google.maps.android:android-maps-utils:3.8.2
```

Attributed to the package that pulls each one in:

| Native dependency | Pulled in by | Declared in |
|---|---|---|
| `com.google.firebase:firebase-messaging:24.0.1` | `expo-notifications` | `node_modules/expo-notifications/android/build.gradle` |
| `com.google.android.gms:play-services-location:21.0.1` | `expo-location` **and** `react-native-maps` | `node_modules/expo-location/android/build.gradle`, `node_modules/react-native-maps/android/build.gradle` |
| `com.google.android.gms:play-services-maps` | `react-native-maps` | `node_modules/react-native-maps/android/build.gradle` |
| `com.google.android.gms:play-services-base` | `react-native-maps` | same file |
| `com.google.maps.android:android-maps-utils:3.8.2` | `react-native-maps` | same file |
> **RESOLVED — `expo-dev-client` has been removed from the project.** It used to be a production
> dependency and autolinked unconditionally (Expo's autolinking adds every resolved module with `api`
> scope; the `debugOnly` flag in `expo-dev-launcher` applies to Apple only). That dragged
> `com.google.android.gms:play-services-code-scanner` and `com.google.mlkit:barcode-scanning` into the
> release AAB — third-party SDKs with no feature behind them, in an app whose Data safety form declares
> no such collection — plus a developer menu in a production courier app.
>
> Verified after removal:
> ```
> $ npx expo-modules-autolinking resolve -p android --json | grep -c expo-dev-client
> 0
> $ npx expo prebuild --platform android --clean && grep -rn "barcode-scanning\|code-scanner" android/
> (no matches)
> ```
> **Consequence for QA:** there is no dev-client build any more. Use `npx expo run:android` for
> on-device development and background-location testing — it builds the real native debug app with
> every native module present, which is what that QA needs. If you ever want the dev launcher UI back,
> install `expo-dev-client` temporarily and **never** ship a release build with it present.

**What this changes in your answers** (see §4 for the full table):

- **Firebase Cloud Messaging** generates an app-instance registration token and exchanges it with
  Google's servers, independently of your own `POST /api/v1/device-tokens` call. That is why
  **Device or other IDs → Collected: Yes** is not optional.
- It is still **Shared: No**. Play defines sharing as "transferring user data collected from your app
  to a third party" and explicitly excludes "transferring user data to a 'service provider' that
  processes it on behalf of the developer". Google/Firebase is your service provider for push
  delivery, and Google Play services is the platform delivering maps and location. Answer **No**, and
  keep this paragraph so you can say it out loud if a reviewer asks.
- **None of these is an ad, analytics, or crash-reporting SDK.** No AdMob, no Crashlytics, no
  Firebase Analytics — `firebase-messaging` alone does not pull them in.

**Crash reporting is present but self-hosted and off by default.** `lib/crashReporting.ts` exists in
this tree. It installs a global JS error handler, always logs via `logger.error`, and **only**
transmits when `EXPO_PUBLIC_CRASH_ENDPOINT` is set — a fire-and-forget POST of
`{ message, stack, platform, appVersion }` to a URL **you** control (`constants/config.ts:57` lists it
among the consumed env vars). It integrates no third-party SDK.

> `[ACTION REQUIRED: decide whether to set `EXPO_PUBLIC_CRASH_ENDPOINT` for the production build.]`
> - **Left unset** → nothing leaves the device → Data safety **Crash logs: No**, **Diagnostics: No**.
> - **Set** → **Crash logs: Yes**, collected, purpose *App functionality / Diagnostics*, **Shared: No**
>   (it is your own endpoint). Your privacy policy must then say so.
>
> This is a build-time flag, so the honest answer depends on how you build. Decide before you file the form.

Analytics remain off: `constants/config.ts:254` — `ENABLE_ANALYTICS: false`.

### 1.4 Transport security — TLS is enforced in code

This is **not** the old "no scheme validation" situation. `constants/config.ts` now forces production
traffic onto TLS and refuses to build a working bundle without a base URL:

```ts
// constants/config.ts:23-28
export const enforceSecureTransport = (url: string): string => {
  if (__DEV__) { return url; }
  return upgradeToSecureTransport(url);
};

// constants/config.ts:73-83
const resolveBaseUrl = (): string => {
  const envBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (__DEV__) { return envBaseUrl || 'http://localhost:8080'; }
  if (!envBaseUrl) {
    throw new Error('EXPO_PUBLIC_RORK_API_BASE_URL must be set for production builds');
  }
  return enforceSecureTransport(envBaseUrl);
};
export const BASE_URL = resolveBaseUrl();
```

The `localhost:8080` fallback is reachable **only under `__DEV__`**. A production bundle with the env
var unset throws at module load rather than silently pointing at localhost. WebSocket URLs get the
same treatment (`constants/config.ts:315,317`), as do the routing and crash endpoints
(`lib/routing.ts:60`, `lib/crashReporting.ts`).

There is also a placeholder guard: `constants/config.ts:60-71` throws at startup if any consumed
`EXPO_PUBLIC_*` value still contains `REPLACE_ME`.

> **Data safety consequence:** you can answer **"Data is encrypted in transit: Yes"** honestly,
> provided the build is a production build (`__DEV__` false) and `EXPO_PUBLIC_RORK_API_BASE_URL` is
> set. Verify the value actually got baked in, after bundling:
> ```bash
> npx expo export --platform android --output-dir /tmp/zbr-export
> grep -o 'https\?://[a-zA-Z0-9._:-]*' /tmp/zbr-export/_expo/static/js/android/*.js | sort -u | head -20
> ```
> `EXPO_PUBLIC_*` values are inlined at bundle time — set them in the shell that runs Gradle.

### 1.5 Google Maps API key — the config block exists; the key is empty

`app.config.ts:96-100` **does** carry the `android.config.googleMaps` block, fed from the environment
at `app.config.ts:39`:

```ts
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
…
config: { googleMaps: { apiKey: googleMapsApiKey } },
```

But with `GOOGLE_MAPS_API_KEY` unset the resolved value is the empty string:

```
$ npx expo config --type prebuild --json | jq -r '.android.config.googleMaps.apiKey'
""
```

`app.config.ts:40-46` warns loudly when this happens ("*Do NOT upload this build*"), deliberately
without being fatal so dev machines can still prebuild. **That warning is your only signal** — it
scrolls past in a long prebuild log, and Expo's plugin then omits the
`com.google.android.geo.API_KEY` meta-data entirely, so the map renders as a grey rectangle in a
map-centric delivery app with no runtime error at all.

> `[BLOCKER]` `[ACTION REQUIRED: obtain a Google Maps SDK for Android API key, restrict it to package
> `app.zbr.courier` + the **Play app-signing** SHA-1 (not just your upload key), and export it as
> `GOOGLE_MAPS_API_KEY` in the shell that runs prebuild.]`
>
> Restricting to the upload-key SHA-1 alone is the classic mistake: Play re-signs your AAB with the
> app-signing key, so the installed app presents a fingerprint your restriction does not allow and the
> map goes grey **only in the Play build**. Both fingerprints are on Play Console → Setup → App signing.
>
> A reviewer opening a courier app whose map does not render fails it on broken functionality — and
> your background-location justification ("we show the courier their route") becomes unprovable on video.

### 1.6 `android/` is generated output and is not in the tree

```
$ ls -d android
ls: cannot access 'android': No such file or directory
```

There is no stale `android/` directory to worry about — nothing on disk can override the config.
Generate it immediately before every release build and check the result:

```bash
cd /home/user/elcafe-courier-mobile-app
npx expo prebuild --platform android --clean
grep -n 'applicationId' android/app/build.gradle                                   # app.zbr.courier
grep -c 'ACCESS_BACKGROUND_LOCATION' android/app/src/main/AndroidManifest.xml      # >= 1
```

The applicationId is permanent once published — uploading under the wrong package name burns that
name on your Play account forever. Check it every time.

### 1.7 Authoritative permission list

> `[RE-VERIFY]` **`app.config.ts` and `package.json` are owned elsewhere and changed twice while this
> document was being written.** Everything in §1.7 and §1.8 was re-derived from the tree at the last
> edit; re-run the command below before you fill any form.

Two layers combine. Layer one is the resolved config
(`npx expo config --type prebuild --json`), run against the current tree:

```json
"permissions": [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.VIBRATE",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.INTERNET"
],
"blockedPermissions": [
  "android.permission.RECORD_AUDIO",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE"
]
```

(The raw array repeats several location entries — `app.config.ts:101-108` lists six by hand and the
`expo-location` plugin re-adds its own. Duplicates are harmless; the merger de-duplicates.)

`blockedPermissions` (`app.config.ts:113-134`) is the **only** mechanism that emits the
`tools:node="remove"` merge directive — `node_modules/@expo/config-plugins/build/android/Permissions.js`.
Expo's permission plugin only ever *adds*, so blocking is the sole way to strip a permission a
dependency's own manifest declares.

Layer two is **library manifests, merged by Gradle at build time** — these never appear in the
resolved config, only in the built artifact:

| Library | Adds at merge time | Verified in |
|---|---|---|
| `expo-notifications` | `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` | `node_modules/expo-notifications/android/src/main/AndroidManifest.xml` |
| `expo-audio` | `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `MODIFY_AUDIO_SETTINGS` — the first and third are **blocked** (§1.8) | `node_modules/expo-audio/android/src/main/AndroidManifest.xml` |
| `expo-file-system` | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` — both **blocked** (§1.8) | `node_modules/expo-file-system/android/src/main/AndroidManifest.xml` (sole source; `expo-image` declares only `INTERNET` + `ACCESS_NETWORK_STATE`) |
| `expo-image` | `ACCESS_NETWORK_STATE` | `node_modules/expo-image/android/src/main/AndroidManifest.xml` |

**`expo-image-picker` has been removed from the project** — no `CAMERA`, and nothing imports it:

```
$ ls -d node_modules/expo-image-picker
ls: cannot access 'node_modules/expo-image-picker': No such file or directory
$ grep -rn "expo-image-picker\|ImagePicker" --include=*.ts --include=*.tsx . | grep -v node_modules
(no output)
$ grep -rln "permission.CAMERA" node_modules/*/android/src/main/AndroidManifest.xml
(no output)
```

No library declares `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` either, so **you do not need Play's Photo
and Video Permissions declaration.** Confirm on your real bundle:

```bash
bundletool build-apks --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=/tmp/zbr.apks --mode=universal
unzip -p /tmp/zbr.apks universal.apk > /tmp/zbr-universal.apk
$ANDROID_HOME/build-tools/*/aapt2 dump permissions /tmp/zbr-universal.apk
```

Anything in that output is what Play sees. If `READ_MEDIA_IMAGES` appears, you have acquired a Photo
and Video Permissions declaration obligation.

### 1.8 The microphone permission — handled, but verify it stuck

`services/soundService.ts` plays a bundled new-order alert and **never records**. It was migrated from
`expo-av` (deprecated in SDK 54) to `expo-audio` precisely because of this permission —
`services/soundService.ts:1-12` documents the reasoning. But `expo-audio`'s **library manifest
declares the microphone unconditionally**, so the plugin option alone is not enough:

```
$ grep -o 'android:name="android.permission.[A-Z_]*"' node_modules/expo-audio/android/src/main/AndroidManifest.xml | sort -u
android:name="android.permission.FOREGROUND_SERVICE"
android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
android:name="android.permission.MODIFY_AUDIO_SETTINGS"
android:name="android.permission.RECORD_AUDIO"
```

`app.config.ts` now does **all three** things needed, and all three are required:

1. Plugin options `microphonePermission: false` / `recordAudioAndroid: false` (`app.config.ts:174-181`)
   — stops the *plugin* adding them.
2. `android.blockedPermissions` listing `RECORD_AUDIO` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
   (`app.config.ts:113-134`) — the only thing that strips the *library manifest* copies.
3. The local plugin `./plugins/withAndroidNoUnusedAudioServices` (`app.config.ts:202`) — removes
   `expo-audio`'s `AudioRecordingService` (`foregroundServiceType="microphone"`) and
   `AudioControlsService` (`mediaPlayback`) service declarations, so nothing in the shipped manifest
   suggests this delivery app records audio.

`SYSTEM_ALERT_WINDOW` is blocked too — it arrives from the bare prebuild template and would surface
"Display over other apps" on your listing for a feature that does not exist.

**Why this mattered enough to spell out:** a courier app shipping `RECORD_AUDIO` would have to declare
microphone access on its listing, answer for it in Data safety, and defend a permission it never uses —
a near-certain rejection. `FOREGROUND_SERVICE_MEDIA_PLAYBACK` would separately have dragged in a
*second* Foreground service permissions declaration (§7.2) for a lock-screen media session this app
never starts.

`MODIFY_AUDIO_SETTINGS` legitimately survives — normal, non-dangerous and never surfaced to the user.
It is used to set the audio mode for the new-order alert. Note it does **not** make the alert play over
Android silent mode: `playsInSilentMode` is an iOS-only option (`AudioModule.kt` reads only
`shouldPlayInBackground` / `interruptionMode` / `shouldRouteThroughEarpiece`), so on a silenced Android
phone the courier is reached by the modal's vibration and the push notification channel instead. See the
comment in `services/soundService.ts`.

> **Verify the merge directive actually worked**, because it is the only thing standing between you and
> both problems. On the built artifact:
> ```bash
> $ANDROID_HOME/build-tools/*/aapt2 dump permissions /tmp/zbr-universal.apk \
>   | grep -E "RECORD_AUDIO|FOREGROUND_SERVICE_MEDIA_PLAYBACK|SYSTEM_ALERT_WINDOW"
> # must print nothing
> ```

**Guiding rule:** every permission in the merged manifest must map to a feature a reviewer can *see
working in your build*. Declared-but-unused permissions are the cheapest rejection to avoid and the
easiest to overlook — this project nearly shipped three by accident, all three from dependencies and
none from anyone's intent.

`scripts/verify-aab.sh` no longer hardcodes an expected-permission list: it derives the declared and
blocked sets from `npx expo config --type prebuild --json` and the library-merged set by scanning
`node_modules/*/android/src/main/AndroidManifest.xml` on each run, then fails only on a blocked
permission that leaked into the artifact or a declared one that went missing. Permissions that
legitimately merge in — `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `ACCESS_NETWORK_STATE` — are
explained rather than flagged. Read its output; do **not** "fix" a merged permission by blocking it.

### 1.9 Push tokens: native FCM, no Expo push service

**This is correct in the current tree.** `services/pushNotification.ts:86` requests the **native**
device token:

```ts
// services/pushNotification.ts:86
const tokenData = await Notifications.getDevicePushTokenAsync();
```

```
$ grep -n "getDevicePushTokenAsync\|getExpoPushTokenAsync\|projectId" services/pushNotification.ts
86:    const tokenData = await Notifications.getDevicePushTokenAsync();
```

No `getExpoPushTokenAsync`, no `projectId` and no `eas.json` anywhere in the repo. (`EXPO_PUBLIC_PROJECT_ID`
survives only as a placeholder string inside `lib/__tests__/config-guards.test.ts`, which asserts the
REPLACE_ME guard — no runtime code reads it.) On Android this returns the **FCM registration token**; on iOS the raw APNs device token. The
module documents exactly this at `services/pushNotification.ts:43-54`, and the backend routes on the
`deviceType` field sent alongside (`services/pushNotification.ts:159-163`) to
`POST /api/v1/device-tokens` (`constants/config.ts:141-144`).

The service is well-behaved for review purposes: it returns a typed
`PushTokenResult` (`:28-32`) distinguishing `permission-denied` from `error`, skips registration when
the user has toggled notifications off (`:110-116`, `:137-140`), and unregisters all tokens on logout
(`:195-223`).

> `[BLOCKER]` `[ACTION REQUIRED: place `google-services.json` at the repo root before prebuild.]`
> `getDevicePushTokenAsync()` **throws on Android** without it, and `app.config.ts:25-34` omits
> `googleServicesFile` with only a `console.warn` when the file is missing — a warning that scrolls
> past in a long prebuild log. Verified absent right now:
> ```
> $ npx expo config --type prebuild --json | jq -r '.android.googleServicesFile'
> null
> ```
> Check explicitly every time: `ls -l google-services.json`.

### 1.10 Background location is implemented

**This is correct in the current tree** and is the foundation of the §5 declaration. See §5.1 for the
full mechanism with citations.

### 1.11 In-app account deletion is real

**This is correct in the current tree.** See §6.1 for the code and the endpoint.

---

## 2. Pre-submission blockers checklist

Ordered by how likely each is to actually stop *this* app.

| # | Blocker | Why it bites this app | Where |
|---|---|---|---|
| 1 | **No reviewer demo account** | Reviewers hit `app/login.tsx` and cannot get past it. Even with credentials they land on `app/verification-pending.tsx` unless the account is pre-verified server-side (`app/_layout.tsx:45-52`). The single most common rejection for courier apps. | §3 |
| 2 | **Background-location declaration + demo video** | `ACCESS_BACKGROUND_LOCATION` is in the resolved config **and the feature is implemented**, so the declaration is approvable — but it is a manual human review with a mandatory video. Days per round-trip. | §5 |
| 3 | **No account-deletion web URL** | Play requires a publicly reachable URL **in addition to** the in-app path, which exists. Nothing in this repo hosts one. | §6.2 |
| 4 | **No privacy policy URL** | `app/onboarding.tsx:27` reads `EXPO_PUBLIC_PRIVACY_URL`; with it unset the link is hidden entirely (`:165`). Play requires the URL regardless. | §10.2 |
| 5 | **Empty Google Maps API key → grey map** | `GOOGLE_MAPS_API_KEY` unset resolves to `""`. Reviewer sees a blank rectangle in a map-centric app. | §1.5 |
| 6 | **`google-services.json` missing → push dead + token call throws** | `app.config.ts:25-34` warns and continues. | §1.9 |
| ~~7~~ | ~~**`expo-dev-client` is a production dependency**~~ **RESOLVED** | Removed from the project. It autolinked `expo-dev-launcher`, pulling Google's code-scanner + ML Kit barcode SDKs into the release AAB and a developer menu into production. Verified absent from a fresh prebuild. Use `npx expo run:android` for on-device QA. | §1.3 |
| 8 | **`EXPO_PUBLIC_RORK_API_BASE_URL` unset at bundle time** | Production build **throws at module load** (`constants/config.ts:78`) — the app does not start at all. | §1.4 |
| 9 | **`EXPO_PUBLIC_ROUTING_URL` unset in production** | Route polylines silently disappear (`lib/routing.ts:69-78`). Not a policy issue; a visibly degraded app on video. | §4 Note A |
| 10 | **Contact details are placeholders** | `constants/config.ts:270-271` — `SUPPORT_EMAIL: 'support@courierapp.com'`, `SUPPORT_PHONE: '+998901234567'`. `app/verification-pending.tsx` opens both. | §3.2 |
| 11 | **"Withdraw Funds" FAQ string points at a button that does not exist** | `i18n/locales/en.json:418` tells the courier to "Go to the Earnings tab and tap 'Withdraw Funds'". `app/(tabs)/finance.tsx` has no such control. Your own app instructing a user to tap a nonexistent button is a deceptive-behaviour finding. | §10.1 |

---

## 3. App access instructions — the most important section

### 3.1 Why this app is high-risk here

A Play reviewer is a person with a test device and no relationship to your business. For ZBR Courier
they hit **three** walls:

1. **Login wall.** `app/index.tsx` routes to onboarding, then `/login`. Nothing is reachable unauthenticated.
2. **OTP wall.** `app/login.tsx:106-113` renders a *"Log in with phone number"* button that pushes
   `/login-otp`, and `app/forgot-password.tsx:27` redirects there too:
   ```
   $ grep -rn "login-otp" app/
   app/forgot-password.tsx:27:    router.replace('/login-otp');
   app/login.tsx:108:              onPress={() => router.push('/login-otp')}
   app/_layout.tsx:39, :87, :168  (route registration only)
   ```
   **A reviewer cannot receive an SMS on your Uzbek number.** The OTP route *is* reachable from the
   login screen, so your App access notes must state plainly that the reviewer should use **email +
   password** and ignore the phone button. (Earlier notes claiming the OTP route is unreachable from
   the login UI are wrong — it is one tap away.)
3. **Admin-verification wall.** `app/_layout.tsx:45-52`:
   ```ts
   const isVerified = courierProfile?.verified === true ||
     courierProfile?.verificationStatus === 'approved';
   …
   router.replace('/verification-pending');
   ```
   A freshly-registered courier is bounced to `app/verification-pending.tsx` — a dead end offering only
   "call / email / chat support" and "log out". A reviewer landing there sees an app with no
   functionality and will reject for "we were unable to access the app's functionality."

`app/login.tsx` itself is a plain email + password form, so the happy path exists — you just have to
tell the reviewer to take it.

### 3.2 What the team must provision before submitting

`[ACTION REQUIRED]` — all server-side; none can be done from this repo.

1. **A permanent demo courier account** with a real email and password. Not time-limited, not
   rate-limited, no forced password rotation. Play re-reviews on every update for the life of the app.
   **Provided: `demo_courier@zbr.uz` / `Rcsda123!`** — confirm it exists server-side and that the
   password never expires. Treat it as a demo-only identity: no real courier data, no real cash
   operations, and rotate the password if this repository ever becomes public.
2. **Server-side pre-verification.** The account's profile must return `verified: true` from
   `GET /api/v1/couriers/me` so `app/_layout.tsx:46` routes it to `/(tabs)/orders`. Verify on a clean install.
3. **Seeded test orders.** The Available list is empty unless the courier is online *and* the backend
   returns offers. A reviewer who toggles online and sees an empty list has nothing to evaluate — and
   **you cannot demonstrate the background-location use case** required by §5. Seed:
   - 2–3 durable offers on `GET /api/v1/couriers/me/available-orders` near the demo device.
   - 1 accepted/active order so the reviewer can walk `READY → PICKED_UP → IN_TRANSIT → DELIVERED`.
   - Non-empty earnings on `GET /api/v1/couriers/me/earnings` so the Finance tab isn't blank.
4. **Geographic tolerance.** Reviews are typically performed from outside Uzbekistan. If the backend
   filters offers by proximity to Tashkent, exempt the demo account. This is the quiet killer: login
   works, and the reviewer still sees an empty app.
5. **A reachable support email.** Replace `constants/config.ts:270` `SUPPORT_EMAIL` with a monitored
   address, and use the same one as the Console listing contact email.

### 3.3 Ready-to-paste App access form entry

Play Console → **App content → App access** → **"All or some functionality is restricted"** → one instruction set.

> **Name of the instruction set**
> `Courier login (email + password) — full app access`
>
> **Any other information needed to access your app**
>
> ```
> ZBR Courier is a closed app for delivery couriers working for our dispatch
> service. All functionality is behind a login, and courier accounts must
> additionally be approved by our operations team before the app becomes usable.
> We have created a permanent, pre-approved reviewer account so you can skip both.
>
> LOGIN — USE EMAIL AND PASSWORD
> 1. Install and open the app.
> 2. Swipe through or tap "Skip" on the onboarding screens.
> 3. On the login screen enter:
>      Email:    demo_courier@zbr.uz
>      Password: Rcsda123!
>    and tap Log in.
> 4. This account is already approved by our operations team, so you go
>    straight to the Orders screen. You will NOT see the "verification
>    pending" screen.
>
> PLEASE IGNORE THE "LOG IN WITH PHONE NUMBER" BUTTON. It sends an SMS code to
> Uzbek mobile numbers and is for our couriers only. The email + password form
> above gives you the same full access and needs no SMS code.
>
> WHAT TO DO NEXT (this exercises every feature, including background location)
> 5. On the Orders screen, tap the toggle switch in the top-right to go ONLINE.
>    - Before any Android system dialog appears, the app shows its own
>      "Location Sharing" disclosure explaining what location is collected,
>      why, and that collection continues while the app is in the background
>      or closed. Tap "Agree".
>    - Grant "While using the app", then grant "Allow all the time" when the
>      app requests background access.
> 6. The "Available" tab now lists test delivery offers seeded on this account.
>    Tap any offer to see pickup and drop-off on the map.
> 7. Tap "Accept" to take the delivery. It moves to the "Active" tab.
> 8. Open the active order and use the status buttons to advance it:
>    Picked up -> In transit -> Delivered.
> 9. Tap "Navigate" to see the handoff to Google Maps. This is the situation
>    background location exists for: the courier drives inside Google Maps
>    while our dispatch system needs the live position to update the
>    customer's tracking screen. A persistent "ZBR Courier is on shift"
>    notification shows while tracking is active.
> 10. The Finance tab shows seeded earnings for this account.
> 11. Settings -> Delete Account performs a real, immediate account deletion.
>     Please do not use it on the reviewer account unless you intend to; ask us
>     and we will provision a second throwaway account for testing it.
>
> SUPPORT
> If the account stops working or the test orders are missing, email
> [ACTION REQUIRED: support@your-domain.com] and we will restore them same day.
> ```

**Do not tick "All functionality is available without special access".** It is false here and produces
an immediate rejection when the reviewer hits the login screen.

---

## 4. Data safety form — complete answer sheet

Play Console → **App content → Data safety**. Transcribe field by field.

### 4.1 Top-level questions

| Console question | Answer | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Location, account data, and device tokens are transmitted. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | `constants/config.ts:23-28,73-83` force `https://`/`wss://` in non-`__DEV__` builds. See §1.4. |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In-app deletion is real (§6.1); the web URL is `[ACTION REQUIRED]` (§6.2). |
| Has your app been independently validated against a global security standard? | **No** | Optional badge; no such audit. No penalty for No. |

### 4.2 Data type answer table

For each row Console asks: *Collected? · Shared? · Processed ephemerally? · Required or optional? · Purposes?*

"Shared" in Play's sense = transferred to a **third party**. Data sent to **your own** backend
(`BASE_URL`) is *collection*, not sharing — and per §1.3, transfers to a **service provider**
(Google/Firebase for push, maps, and location services) are also excluded from "sharing".

| Data type | Collected | Shared | Ephemeral | Req/Opt | Purposes | Code evidence |
|---|---|---|---|---|---|---|
| **Location → Precise location** | **Yes** | **No** — note A | **No** (persisted server-side) | **Required** | App functionality | Foreground: `context/CourierContext.tsx:1635` `Location.watchPositionAsync({ accuracy: Location.Accuracy.High, … })` → `updateLocationOnServer` (`:1581`) → `PUT /api/v1/couriers/me/location` (`constants/config.ts:111`). Background: `lib/backgroundLocation.ts:36-51` PUTs `{latitude, longitude, accuracy, heading, speed}` to the same endpoint. |
| **Location → Approximate location** | **Yes** | **No** — note A | No | Required | App functionality | `ACCESS_COARSE_LOCATION` in the resolved config (§1.7). If a courier grants "Approximate only", the same `PUT` runs with coarsened coordinates. Declare it. |
| **Personal info → Name** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:30-31` collects `firstName`/`lastName`, posted to `/api/v1/auth/register`. |
| **Personal info → Email address** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:32`; login credential in `app/login.tsx`. |
| **Personal info → Phone number** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:33`; also the OTP identifier for the `/login-otp` route (§3.1). |
| **Personal info → User IDs** | **Yes** | No | No | Required | App functionality, Account management | Backend `User.id` / `CourierProfile.id`, cached under `TOKEN_CONFIG.USER_KEY`. |
| **Personal info → Other info** (driving licence number, vehicle registration plate, vehicle type) | **Yes** | No | No | **Required** to become a courier | App functionality, Account management, **Fraud prevention, security and compliance** | `app/become-courier.tsx:32-35` collects `vehicleType`, `vehicleNumber`, `licenseNumber`, `preferredRadius`; `:42-49` makes plate and licence mandatory. Free-text box: *"Driving licence number and vehicle registration plate, collected once to verify the courier is legally permitted to make deliveries."* |
| **Device or other IDs** | **Yes** | **No** (service provider — §1.3) | No | Required | App functionality | `services/pushNotification.ts:86` obtains the native FCM/APNs token; `:167` posts `{deviceToken, deviceType, appVersion}` to `POST /api/v1/device-tokens`. FCM itself exchanges a registration ID with Google — that is why this is Yes even before your own call. |
| **App activity → Other user-generated content** (delivery issue description) | **Yes** | No | No | **Optional** | App functionality, Customer support | `app/order/[id].tsx:119-136` — issue type + free-text description → `reportOrderIssue` (`context/CourierContext.tsx:1912`) → `POST /api/v1/couriers/me/orders/{id}/issue` (`constants/config.ts:125`). **Text only — no photos.** |
| **App info and performance → Crash logs** | **Conditional** | No | No | Optional | Diagnostics | **No** if `EXPO_PUBLIC_CRASH_ENDPOINT` is unset at build time; **Yes** if set. See §1.3. |
| **Photos and videos → Photos** | **No** | — | — | — | — | `expo-image-picker` has been removed from the project and no library declares `CAMERA` (§1.7). `app/report-issue.tsx:8-10` and `app/chat.tsx:8-10` are now inert `<Redirect>` components; `app/edit-profile.tsx` collects name/email/phone only. No image is transmitted anywhere. |
| **Messages → Other in-app messages** | **No** | — | — | — | — | `app/chat.tsx` is a `<Redirect href="/(tabs)/orders" />` — no messaging surface, no network call. |
| **App info and performance → Diagnostics** | **No** | — | — | — | — | See §1.3. |
| **App activity → App interactions** | **No** | — | — | — | — | No analytics SDK (§1.3); `constants/config.ts:254` `ENABLE_ANALYTICS: false`. |
| **Financial info** (any subtype) | **No** | — | — | — | — | See §9.3. The app *displays* earnings and a cash-payment badge but collects no payment instrument and processes no transaction. |
| **Personal info → Address** | **No** | — | — | — | — | Delivery addresses shown to the courier are the *customer's*, received from your backend for display. Data safety covers data collected **from the app's user**; the courier's own address is never asked for. |
| **Health / Fitness / Contacts / Calendar / SMS / Audio / Files / Web browsing** | **No** | — | — | — | — | No such APIs in the codebase. `RECORD_AUDIO` is stripped by `android.blockedPermissions` (§1.8) and nothing records; `services/soundService.ts` is playback-only. |

#### Note A — routing: no third-party transfer in a correct production build

`lib/routing.ts` no longer hard-codes the public OSRM demo server. It resolves the routing host from
your own environment and **refuses to fall back in production**:

```ts
// lib/routing.ts:51
const DEMO_ROUTING_URL = 'https://router.project-osrm.org';

// lib/routing.ts:56-79
function getRoutingBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_ROUTING_URL;
  if (configured) {
    return enforceSecureTransport(configured).replace(/\/+$/, '');
  }
  if (__DEV__) { return DEMO_ROUTING_URL; }
  // production, unset:
  logger.error('[routing] EXPO_PUBLIC_ROUTING_URL is not set in this production build. …');
  return null;
}
```

`DEMO_ROUTING_URL` is reachable **only under `__DEV__`**. In a production build the value is either
your own routing host or `null`, and `fetchRoute` returns `null` so callers render without a polyline.

Consequences:

- **Answer Shared: No for both location rows**, provided `EXPO_PUBLIC_ROUTING_URL` points at
  infrastructure you operate (self-hosted OSRM, or your own backend proxying it).
- `[ACTION REQUIRED: set `EXPO_PUBLIC_ROUTING_URL` to a routing host you control.]` If you leave it
  unset, nothing leaks — but the map draws no route lines, which looks broken on the demo video and to
  a reviewer. If you were ever to point it at a third-party public service, you would have to flip both
  location rows to **Shared: Yes** and name the recipient in your privacy policy.

#### Note B — no photo collection at all

Earlier drafts of this pack described a photo-upload path in `app/report-issue.tsx` and a profile
avatar in `app/edit-profile.tsx`. Neither exists now: `app/report-issue.tsx` is a 10-line
`<Redirect>` (the order-detail screen has its own text-only issue modal), and `app/edit-profile.tsx`
imports no image picker. **Photos and videos → No** is correct and easy to defend.

### 4.3 Data deletion sub-section

| Field | Answer |
|---|---|
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Users can request account deletion | **Yes** |
| Users can request that some or all data is deleted without deleting their account | **No** (no partial-deletion feature exists) |
| URL where users can request account and data deletion | `[ACTION REQUIRED: https://your-domain.com/delete-account]` — see §6.3 |

---

## 5. Background location declaration and demo video

### 5.1 What triggers this — and what the code actually does

The `expo-location` plugin block (`app.config.ts:152-163`) turns background location on:

```ts
['expo-location', {
  isAndroidForegroundServiceEnabled: true,
  isAndroidBackgroundLocationEnabled: true,
  isIosBackgroundLocationEnabled: true,
  …
}]
```

which injects `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_LOCATION`
into the resolved permission list (§1.7). `ACCESS_BACKGROUND_LOCATION` routes your submission to
**App content → Sensitive app permissions → Location permissions**, a *manual human review* with a
written justification and a **mandatory video**. `FOREGROUND_SERVICE_LOCATION` separately triggers the
**Foreground service permissions** declaration (§7.2) — a *different* form; do not conflate them.

**The feature is implemented.** `lib/backgroundLocation.ts` is a real `expo-task-manager` task with an
Android foreground service, and `expo-task-manager` is a dependency (`package.json:53`,
`expo-task-manager: ~14.0.9`). The mechanism, end to end:

1. **Task registration at module scope.** `lib/backgroundLocation.ts:32` names the task
   `courier-location-task`; `:53-89` calls `TaskManager.defineTask` at import time on native platforms.
   `context/CourierContext.tsx:9` imports the module at app startup precisely so the definition runs
   before the OS can deliver any location event.
2. **Permission, in the order Android requires.** `context/CourierContext.tsx:1608` requests foreground
   permission and throws `'Location permission denied'` if refused. Only after that,
   `:1660-1666` checks `getBackgroundPermissionsAsync()` and calls
   `requestBackgroundPermissionsAsync()` if it can still ask, then
   `startBackgroundLocationUpdates()`. Denied background permission **degrades to foreground-only
   tracking without throwing** (`:1667-1669`) — a courier who says no still gets a working app.
3. **OS-level updates with a foreground service.** `lib/backgroundLocation.ts:115-131`:
   ```ts
   await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
     accuracy: Location.Accuracy.Balanced,
     timeInterval: LOCATION_CONFIG.BACKGROUND_INTERVAL,      // 60000 ms
     distanceInterval: LOCATION_CONFIG.DISTANCE_FILTER,      // 10 m
     deferredUpdatesInterval: LOCATION_CONFIG.BACKGROUND_INTERVAL,
     showsBackgroundLocationIndicator: true,
     foregroundService: {
       notificationTitle: 'ZBR Courier is on shift',
       notificationBody: 'Sharing your location with dispatch while you are on shift.',
       notificationColor: '#059669',
     },
   });
   ```
   That `foregroundService` block is what produces the persistent notification the reviewer must see
   in the video, and what keeps the process alive.
4. **What the task does with a fix.** `lib/backgroundLocation.ts:61-84` takes only the latest fix,
   reads the access token through `services/tokenManager.ts` (storage-backed, so it works in a
   headless JS revival), and `PUT`s `{latitude, longitude, accuracy, heading, speed}` to
   `/api/v1/couriers/me/location`. A 401/403 triggers exactly one single-flight
   `tokenManager.refresh()` and one retry; transient failures are swallowed because the next fix retries.
5. **It stops.** `lib/backgroundLocation.ts:138-152` `stopBackgroundLocationUpdates()` is called from
   `stopLocationTracking`, which `toggleOnline` (`context/CourierContext.tsx:1677`) invokes when the
   courier goes OFFLINE and when a status change is rejected server-side.

Guards worth quoting to a reviewer: `startBackgroundLocationUpdates` is a **no-op** on web, when
background permission is not granted (`lib/backgroundLocation.ts:104-108`), and when updates are
already running (`:110-113`).

> Any note claiming this app "declares background location but does not implement it" describes an
> older tree. Re-confirm for yourself before you file the declaration:
> ```bash
> grep -n "startLocationUpdatesAsync\|defineTask\|foregroundService" lib/backgroundLocation.ts
> grep -n "requestBackgroundPermissionsAsync\|startBackgroundLocationUpdates" context/CourierContext.tsx
> grep -n "expo-task-manager" package.json
> ```

### 5.2 The permission-justification text

Console gives you a free-text box (roughly 500 characters — check the live limit and trim to fit):

> ZBR Courier is a workforce app used only by delivery couriers under contract to our dispatch service.
> Background location is core, not optional: while a courier is on an active delivery they navigate
> inside Google Maps, so our app is not in the foreground, yet dispatch and the waiting customer need
> the courier's live position for accurate tracking and ETA. It also lets us offer each new order to
> the nearest available courier. Tracking runs only while the courier has explicitly toggled themselves
> online, and stops the moment they go offline.

If you are given more room:

> **Feature requiring background location:** live delivery tracking and proximity-based order dispatch.
>
> **Why foreground-only access is insufficient:** the courier's core task is driving. From the moment
> they accept an order they are in a turn-by-turn navigation app — the app deliberately hands off to
> Google Maps, because riding through Tashkent traffic requires a real navigation app, not our map
> view. ZBR Courier is therefore backgrounded for most of every delivery. During exactly that window,
> three things depend on the courier's position: (1) the customer's live tracking map, (2) dispatch's
> ability to detect a stalled or off-route delivery, and (3) matching the next order to the nearest
> courier. A foreground-only implementation would report the courier's location only while they are
> staring at our app, which is precisely when they are not delivering.
>
> **How it is implemented:** an `expo-task-manager` background task registered as
> `courier-location-task`, started via `Location.startLocationUpdatesAsync` with an Android foreground
> service whose persistent notification reads "ZBR Courier is on shift — Sharing your location with
> dispatch while you are on shift." Updates are batched at 60-second intervals with a 10-metre distance
> filter. Each fix is sent to our own server over TLS; nothing is sent to any third party.
>
> **User control:** collection begins only when the courier flips the "Online" switch on the Orders
> screen and ends when they flip it off or log out. A courier who is off-shift is not tracked. Before
> the first Android permission dialog we show an in-app disclosure the courier must accept; declining
> background permission leaves the app fully usable with foreground-only tracking.
>
> **Audience:** distributed to our own contracted couriers. Not a consumer app; no consumer-facing
> tracking features.

### 5.3 Prominent disclosure — it exists; here is the actual copy, judged

**`components/LocationDisclosureModal.tsx` exists and gates the first location permission request.**

The flow, verified:

- `app/(tabs)/orders.tsx:14` imports the modal and `LOCATION_DISCLOSURE_ACCEPTED_KEY`.
- `app/(tabs)/orders.tsx:281-292` — `handleToggleOnline` is the Switch's `onValueChange` (`:431`).
  Going **offline** never shows the disclosure. Going **online** calls `isDisclosureAccepted()`
  (`:231-243`, reading `locationDisclosureAccepted` from AsyncStorage); if not accepted it sets
  `showLocationDisclosure` and **does not touch the permission API**.
- `app/(tabs)/orders.tsx:294-303` — `handleDisclosureAgree` persists acceptance, then calls
  `performToggleOnline()`, which is the only path into
  `CourierContext.toggleOnline` → `startLocationTracking` →
  `Location.requestForegroundPermissionsAsync()` (`context/CourierContext.tsx:1608`).
- `app/(tabs)/orders.tsx:305-308` — `handleDisclosureNotNow` simply closes the modal; the toggle stays off.

So the OS prompt provably cannot fire before the disclosure is accepted.

**The actual copy** (`components/LocationDisclosureModal.tsx:54-86`, with matching translations in
`i18n/locales/{en,ru,uz}.json:772-778`):

> **Title:** Location Sharing
>
> **Body:** To dispatch nearby orders and share your live position with restaurants and customers, this
> app collects location data while you are online — including when the app is in the background or closed.
>
> **Note:** Your location is not collected while you are offline.
>
> **Buttons:** `Agree` · `Not now`

**Judged against Google's stated requirements**
(<https://support.google.com/googleplay/android-developer/answer/9799150>, read 2026-08-22), which are:
describe the data accessed or collected; explain how it will be used and/or shared; include the term
**"location"**; indicate background use with **one of** the phrases *"background"* / *"when the app is
closed"* / *"always in use"* / *"when the app is not in use"*; and list all app features that use
location in the background.

| Requirement | Met? | Where |
|---|---|---|
| Describes the data collected | **Yes** | *"collects location data"* |
| Explains use and sharing | **Yes** | *"To dispatch nearby orders and share your live position with restaurants and customers"* |
| Includes the term "location" | **Yes** | *"location data"*, and the title *"Location Sharing"* |
| Carries an accepted background phrase | **Yes** | *"including when the app is in the background or closed"* — contains both **"background"** and **"closed"**, and Google's list requires only one |
| Lists the features using background location | **Yes** | proximity dispatch of nearby orders, and live position sharing with restaurants and customers — these are exactly the two uses §5.2 justifies |
| In-app dialog, before the runtime prompt | **Yes** | `app/(tabs)/orders.tsx:281-303`, above |
| Affirmative consent, with a decline option | **Yes** | `Agree` / `Not now`; Google's guidance prefers consent language over "Allow access", and "Agree" is the recommended verb |
| Translated for the real user base | **Yes** | en/ru/uz at `i18n/locales/*.json:772-778`; the Russian and Uzbek bodies carry the same background clause |

**Verdict: the copy meets the policy as written. Do not change it before recording the video** — the
reviewer approves a specific flow, and altering the disclosure copy later forces a re-record and a
fresh declaration (§11.2).

Two optional refinements, neither required, both **out of scope for this document** (another agent
owns `components/`):

- The modal does not mention route calculation, which `NSLocationWhenInUseUsageDescription`
  (`app.config.ts:76-77`) does. Harmless: routing runs in the foreground, and the disclosure must list
  *background* uses, which it does.
- Google's example sentence is *"…even when the app is closed or not in use."* If you want to match the
  reviewer's muscle memory verbatim, changing *"including when the app is in the background or closed"*
  to *"even when the app is closed or not in use"* costs nothing — but it is a preference, not a defect,
  and it would require re-translating ru/uz and re-recording the video. **Recommendation: leave it.**

### 5.4 Demo video — a ~30 second script

**What Console requires:** a link to a video showing the in-app feature that uses background location,
the prominent in-app disclosure dialog, and the runtime prompt. Google's guidance is explicit on
length: **"Aim for a video duration of 30 seconds or less."**
(<https://support.google.com/googleplay/android-developer/answer/9799150>, read 2026-08-22.) The video
must be viewable without logging in.

Earlier drafts of this pack specified a 90–150 second, ten-shot script ending at 2:05. **That is
roughly four times too long** and buries the three things the reviewer is actually checking for. Use
the cut below.

**Format:** portrait screen recording of a **real Android device** (never an emulator — the permission
dialogs look subtly wrong and reviewers notice). Burnt-in captions; no voice-over needed. Record with
the device's screen recorder or `adb shell screenrecord`. Log in and get to the Orders screen
*before* you start recording — the login is not what is being demonstrated.

| # | Time | What is on screen | Burnt-in caption |
|---|---|---|---|
| 1 | 0:00–0:03 | Orders screen, courier offline. Tap the **Online** toggle, top-right. | *"ZBR Courier — a workforce app for contracted delivery couriers. Tracking starts only when the courier goes online."* |
| 2 | 0:03–0:11 | **The disclosure appears. Hold it still, unmoving, for a full 8 seconds** so every line is readable. Do not scroll or zoom out. | *"Our own disclosure appears BEFORE any Android dialog: location is collected while online, including when the app is in the background or closed."* |
| 3 | 0:11–0:14 | Tap **Agree**. The Android foreground dialog appears; tap **"While using the app"**. | *"Only after the courier agrees does Android ask."* |
| 4 | 0:14–0:19 | The background-permission request follows; grant **"Allow all the time"** (on Android 11+ this opens Settings — record that, tap it, return). | *"Background access is a separate, deliberate grant."* |
| 5 | 0:19–0:27 | Open an active order, tap **Navigate**. **Google Maps fills the screen.** Pull the notification shade down far enough to show the persistent *"ZBR Courier is on shift"* notification while Maps is still on top. Hold 6–8 s. | *"The courier now drives inside Google Maps. Our app is in the background, still sending the live position to dispatch and to the customer's tracking screen. The ongoing notification shows tracking is active."* |
| 6 | 0:27–0:30 | Back in ZBR Courier, toggle **Offline**. The tracking notification disappears. | *"Going offline stops collection immediately."* |

Shots 2, 3–4 and 5 are the three elements Console names. If you are over 30 seconds, trim shot 5 and
shot 6 — never shot 2.

**What ruins the video, in order of frequency:**
- Disclosure shown *after* the system dialog, or not at all.
- Disclosure on screen for under 3 seconds.
- Never showing the app actually backgrounded — the reviewer must *see* another app on top while your
  tracking notification persists. Shot 5 is doing that work; do not shortcut it with a screenshot.
- Emulator recording.
- A blank grey map because `GOOGLE_MAPS_API_KEY` was empty (§1.5). Fix that before recording.

### 5.5 Hosting the video

Console asks for a **URL**, not an upload.

- **YouTube, visibility "Unlisted."** Not Private — Google's reviewer is not on your allow-list and
  cannot open a Private video. This is a real and common failure. Not Public unless you want couriers
  finding it.
- Alternative: Google Drive with "Anyone with the link — Viewer", or a plain `https://` link to an MP4
  on your own domain.
- **Open the URL in a private/incognito window with no Google account signed in and confirm it plays.**
  A dead video link is an automatic rejection round-trip.

`[ACTION REQUIRED: record the ≤30 s cut, upload as Unlisted, verify in incognito, paste the URL into the Location permissions declaration]`

---

## 6. Account deletion requirements

Play requires **both** mechanisms. One without the other fails.

### 6.1 In-app deletion — real and wired

**This works.** The deletion lives in **`app/(tabs)/settings.tsx`**, reachable directly from the
Settings screen (`:322-328`, a destructive row labelled "Delete Account" with the subtitle
"Permanently delete your account and data"). `app/(tabs)/settings.tsx:166-214`:

```ts
const handleDeleteAccount = async () => {
  const confirmDelete = Platform.OS === 'web'
    ? window.confirm(t('settings.delete_account_confirm', 'This will permanently delete your account, profile and delivery history. This action cannot be undone. …'))
    : await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('settings.delete_account_title', 'Delete Account'),
          t('settings.delete_account_confirm', '…'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('settings.delete_account_button', 'Delete'), style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });

  if (!confirmDelete) return;

  setIsDeletingAccount(true);
  try {
    const response = await authenticatedFetch('/api/v1/users/me', {   // :184-186
      method: 'DELETE',
    });
    if (!response.ok) { /* surfaces the server message */ throw new Error(message || `HTTP ${response.status}`); }
    await logout();                    // :199
    router.replace('/login');          // :200
  } catch (error: any) { /* logged + shown to the user */ }
  finally { setIsDeletingAccount(false); }
};
```

Checked against the policy requirements:

| Requirement | Status | Evidence |
|---|---|---|
| Deletes the **account**, not just app data | **Yes** | `DELETE /api/v1/users/me` — the user resource, matching `constants/config.ts:102` `ME: '/api/v1/users/me'`. |
| Reachable without contacting support | **Yes** | Settings → Delete Account, one screen from the tab bar. |
| Explicit confirmation | **Yes** | Destructive-styled native `Alert` (web: `window.confirm`) naming account, profile and delivery history as permanent. |
| Real network call, not a simulated one | **Yes** | `authenticatedFetch(… { method: 'DELETE' })` at `:184-186`; non-OK responses throw and surface the server's message (`:188-197`). |
| Post-deletion teardown | **Yes** | `await logout()` then `router.replace('/login')` (`:199-200`). `logout()` is the same context method the Log Out row uses — it clears the stored session and unregisters device tokens via `services/pushNotification.ts:195-223`. |
| No dishonest success message | **Yes** | No "request submitted" alert. Success is a silent transition to the login screen; failure shows the real error. |

**`app/security.tsx` is no longer the deletion path.** It is now an inert redirect —
`app/security.tsx:8-10` returns `<Redirect href="/(tabs)/settings" />` — because the old screen only
simulated change-password / 2FA / biometric flows. Any note pointing at `app/security.tsx:138-156` for
a deletion stub describes an older tree.

> `[ACTION REQUIRED: fix the help-centre FAQ text.]` `i18n/locales/*.json` still tells couriers
> *"Go to Settings > Security > Delete Account."* The real path is **Settings → Delete Account**, and
> `/security` now bounces back to Settings. Correct the string in all three locales so your own app
> does not misdirect a reviewer. (`i18n/` is not owned by this document.)
>
> `[ACTION REQUIRED: test it end-to-end.]` Delete a throwaway account and confirm the credentials no
> longer log in, and that the courier profile and stored location are gone server-side. The client is
> correct; only the backend can prove the data is actually deleted.

### 6.2 Web deletion URL — required, and nothing hosts it

> `[ACTION REQUIRED]` **This is still open, and the in-app path does not satisfy it.**

Play requires a URL reachable **without installing the app and without logging in**, where a user can
request deletion of their account and data. Nothing in this repository serves web content; this must be
hosted on your own domain.

> Suggested URL: `https://<your-domain>/delete-account` — then paste it into
> **App content → Data safety → Data deletion**, and link it from your privacy policy.

### 6.3 Draft content for the web deletion page

Publish as static HTML. Replace every bracketed placeholder. English at minimum; Russian and Uzbek
versions are worth adding since your couriers use all three.

---

**Delete your ZBR Courier account**

ZBR Courier is the app our delivery couriers use to receive and complete deliveries. This page explains
how to delete your ZBR Courier account and the data connected to it. You do not need the app installed
to use this page.

**Option 1 — delete from inside the app (fastest)**

1. Open ZBR Courier and log in.
2. Go to **Settings**.
3. Tap **Delete Account** and confirm.

Your account is closed immediately and the data listed below is deleted on the schedule shown.

**Option 2 — request deletion by email**

If you can no longer sign in, email **[ACTION REQUIRED: privacy@your-domain.com]** from the email
address on your courier account, with the subject **"Delete my ZBR Courier account"**. Include the
phone number registered to the account so we can identify it. We verify that the request comes from the
account holder before acting on it, and confirm by email when deletion is complete.

We respond within **[ACTION REQUIRED: e.g. 3]** working days and complete deletion within **30 days** of
verifying your request.

**What is deleted**

- Your name, email address, and phone number
- Your courier profile: vehicle type, vehicle registration plate, driving licence number, preferred delivery radius
- Your stored location, including the last reported position
- Your device push-notification tokens
- Your delivery history and ratings, and any issue reports you submitted

**What is kept, and why**

- **Financial and tax records of completed deliveries**, in a form no longer linked to your name,
  retained for **[ACTION REQUIRED: the period your accountant requires — e.g. 5 years]** because
  **[ACTION REQUIRED: cite the accounting/tax obligation]**.
- **Anonymised, aggregated delivery statistics** that cannot identify you.

If you want to know what is held about you before deciding, email the address above and ask for a copy.

**Questions:** [ACTION REQUIRED: privacy@your-domain.com] · [ACTION REQUIRED: postal address of the operating company]

---

### 6.4 Console entry

Play Console → **App content → Data safety → Data deletion**:

| Field | Value |
|---|---|
| Do you provide a way for users to request that their data is deleted? | Yes |
| Users can request that their account is deleted | Yes |
| Users can request that some data is deleted without deleting the account | No |
| Account deletion URL | `[ACTION REQUIRED: https://your-domain.com/delete-account]` |

---

## 7. Permissions justification table

The merged manifest is authoritative — regenerate it (§1.6) and dump it (§1.7) before filling anything in.

### 7.1 Dangerous and normal permissions

| Permission | Source | Used? | Justification |
|---|---|---|---|
| `INTERNET` | template | Yes | All API, WebSocket, and push traffic. Normal permission, no declaration. |
| `ACCESS_FINE_LOCATION` | config + expo-location | **Yes** | `context/CourierContext.tsx:1635` requests `Location.Accuracy.High`. Street-level accuracy is needed to match a courier to the nearest order and place them on the customer's tracking map. |
| `ACCESS_COARSE_LOCATION` | config + expo-location | Yes | Paired with FINE per Android convention; supports couriers who grant approximate-only. |
| `ACCESS_BACKGROUND_LOCATION` | expo-location plugin (`isAndroidBackgroundLocationEnabled: true`) | **Yes — implemented** | `lib/backgroundLocation.ts` (§5.1). Live tracking while the courier is inside a navigation app mid-delivery. **Triggers the Location permissions declaration + demo video (§5).** |
| `FOREGROUND_SERVICE` | expo-location plugin (`isAndroidForegroundServiceEnabled: true`) | **Yes** | `lib/backgroundLocation.ts:126-130` declares the `foregroundService` block; its persistent notification tells the courier tracking is active. |
| `FOREGROUND_SERVICE_LOCATION` | expo-location plugin | **Yes** | Android 14+ requires the typed FGS permission for a location foreground service. **Triggers a separate Foreground service permissions declaration — §7.2.** |
| `POST_NOTIFICATIONS` | expo-notifications library manifest | **Yes** | New order offers arrive by push. Runtime permission on Android 13+, requested in `services/pushNotification.ts:69-76`. No Console declaration required. |
| `RECEIVE_BOOT_COMPLETED` | expo-notifications library manifest | Yes (library) | Re-registers scheduled notifications after reboot. Normal permission, merged at build time — it appears only in the built bundle. |
| `VIBRATE` | config | Yes | Notification channel vibration patterns in `app/_layout.tsx`; `expo-haptics` in the UI. Normal permission. |
| `MODIFY_AUDIO_SETTINGS` | expo-audio | Yes | Sets the audio mode for the new-order alert (`services/soundService.ts`). Normal, non-dangerous, invisible to the user. It does **not** defeat Android silent mode — `playsInSilentMode` is iOS-only, so a silenced Android phone reaches the courier via vibration and the push channel instead. |
| ~~`READ_EXTERNAL_STORAGE`~~ / ~~`WRITE_EXTERNAL_STORAGE`~~ | expo-file-system manifest (**blocked**) | **No** | Stripped via `android.blockedPermissions`. Nothing in this app touches external storage; the only transitive consumer is `expo-asset`, which reads bundled assets and the app-private cache — neither needs a permission. **There is no `READ_MEDIA_IMAGES`**, so **no Photo and Video Permissions declaration is needed.** |
| `ACCESS_NETWORK_STATE` | expo-image library manifest | Yes (library) | Lets the image loader check connectivity before fetching. Normal permission, merged at build time. |
| ~~`RECORD_AUDIO`~~ | expo-audio (**blocked**) | **No** | Stripped via `android.blockedPermissions` + `plugins/withAndroidNoUnusedAudioServices`. Nothing records. §1.8 — this one mattered. |
| ~~`FOREGROUND_SERVICE_MEDIA_PLAYBACK`~~ | expo-audio (**blocked**) | **No** | Stripped. Would have forced a *second* FGS declaration for a lock-screen media session this app never starts. |
| ~~`SYSTEM_ALERT_WINDOW`~~ | bare template (**blocked**) | **No** | Stripped. Draw-over-other-apps, unused, and it would surface "Display over other apps" on your listing. |
| ~~`CAMERA`~~ | — | **No** | `expo-image-picker` has been removed; no library in the tree declares `CAMERA` (§1.7). |

### 7.2 Foreground service permissions declaration (separate form, easy to miss)

`FOREGROUND_SERVICE_LOCATION` **will** be in the merged manifest, so Play Console →
**App content → Foreground service permissions** requires a per-type declaration.

Text to paste for the `location` type:

> **Foreground service type:** location
> **Feature it supports:** live delivery tracking while a courier is on an active delivery.
> **Why a foreground service is required:** the courier's phone is in a mount or a pocket while they
> drive, and they are usually inside a navigation app rather than ours. A foreground service is the only
> way Android permits continuous location updates for the duration of a delivery, and its ongoing
> notification is what tells the courier tracking is active, with a one-tap route back into the app.
> **User-facing notification:** a persistent notification reading "ZBR Courier is on shift — Sharing your
> location with dispatch while you are on shift" appears for as long as the courier is online, and
> disappears the moment they go offline.

You can reuse the §5.4 video for this declaration — shot 5, showing the persistent notification while
Google Maps is on top, is exactly what this form is asking to see.

---

## 8. Content rating questionnaire

Play Console → **App content → Content rating**. Issued by IARC; wording varies by rating body.

| Question | Answer | Reasoning |
|---|---|---|
| Category of app | **Utility, Productivity, Communication, or Other** | ZBR Courier is a work tool. Do **not** pick a game category. |
| Violence | **No** | — |
| Sexuality / nudity | **No** | — |
| Language — profanity | **No** | No user-to-user free text is published anywhere. |
| Controlled substances | **No** | Deliveries are described generically; the app renders no product catalogue. If your dispatch service ever carries alcohol, revisit this. |
| Gambling | **No** | — |
| Crude humour / horror / fear | **No** | — |
| **Does the app allow users to interact or exchange content with other users?** | **No** | See §8.1. |
| Does the app share the user's current physical location with other users? | **Yes** | See §8.2. |
| Does the app allow users to purchase digital goods? | **No** | No IAP, no billing library, no payment SDK. |
| Does the app contain publicly visible user-generated content? | **No** | Nothing the courier submits is published to any audience. |
| Does the app collect or share personal information with third parties? | **Yes** | Location, name, email, phone, and device tokens go to your backend and, for push/maps, through Google as a service provider (§1.3). |

**Expected outcome:** the lowest rating available to a utility app that shares location — typically
**ESRB Everyone / PEGI 3 / USK 0 / IARC 3+**, with a "Shares Location" interactive-elements notice.
That notice is normal and harmless.

### 8.1 The user-generated-content question

Only one feature reaches your servers as free text, and it is not UGC:

- **Delivery issue reports.** `app/order/[id].tsx:119-136` sends an issue type plus a free-text
  description to `POST /api/v1/couriers/me/orders/{id}/issue`. It goes to your support staff
  one-to-one and is never shown to another app user. Under IARC's framing this is a support channel,
  not user interaction. Answer **No**, and explain it exactly that way if queried.
- **Chat does not exist.** `app/chat.tsx:8-10` is `<Redirect href="/(tabs)/orders" />` — the old
  client-side mock was removed. No messaging surface, no network call.
- **Order rating is wired but private.** `app/order-rating/[orderId].tsx:74` submits via
  `authenticatedFetch` to your backend. It is a rating *of the delivery*, visible to your back office,
  not published to other users. Not UGC.

**Answer No today.** Set a reminder that the answer flips if chat is ever built — content rating
requires a fresh questionnaire when app behaviour changes (§11.2).

### 8.2 The location-sharing question — answer Yes

The courier's location is transmitted (`context/CourierContext.tsx:1581`, `lib/backgroundLocation.ts:36-51`)
and, per your own product description, surfaced to dispatch operators and to the customer tracking the
delivery. Those are other people. **Answer Yes.** It costs nothing on the resulting rating, and
answering No would contradict your own background-location justification, which a reviewer reads.

---

## 9. Target audience and content

### 9.1 Target age

| Field | Answer |
|---|---|
| Target age groups | **18 and over only.** Deselect every other band. |
| Is your app designed for children? | **No** |
| Does your store listing appeal to children? | **No** |

Reasoning to keep on file: couriers must hold a driving licence — `app/become-courier.tsx:48-49` makes
`licenseNumber` a required field — and must be approved by operations before working. Selecting any
under-18 band drags you into the **Families policy**, which is incompatible with background location
collection.

### 9.2 Ads

| Field | Answer |
|---|---|
| Does your app contain ads? | **No** |

Verified: none of the native Gradle dependencies (§1.3) is an ad SDK, there is no `AD_ID` permission in
the resolved config, and no WebView ad surface. Because you answer No, do **not** declare
`com.google.android.gms.permission.AD_ID` — confirm with the `aapt2 dump permissions` command in §1.7
that nothing pulled it in transitively.

### 9.3 Financial features — the one that needs actual thought

Play asks: *"Does your app provide financial features?"* — sub-types include payments/money transfer,
lending, insurance, investing, crypto, and financial-management tools.

**Answer: No.**

The reasoning, because this is genuinely arguable:

- The app **displays** money. `app/(tabs)/finance.tsx` renders earnings and a withdrawable-balance
  figure from `GET /api/v1/couriers/me/earnings`. Display of your own employment earnings is not a
  financial feature — otherwise every payslip app would be one.
- The app **shows a payment-method badge** on the order screen: a read-only label telling the courier
  whether to expect cash at the door.
- **Couriers do collect cash from customers.** This is what tempts a "Yes". But the cash changes hands
  *in the physical world*, between customer and courier. The app does not initiate, process, route,
  hold, or settle that money. There is no payment SDK, no card entry field, no bank details, no wallet,
  no `BILLING` permission, and `constants/config.ts` `API_ENDPOINTS` contains no payment endpoint.
- Play's financial-features declaration exists to catch apps that *are* the financial instrument.
  A logistics app reporting "this order is cash on delivery" is not one.

**Answer No, and keep this note in your internal submission record:** *"Couriers collect cash on
delivery in person. The app processes no payments, holds no funds, and integrates no payment provider;
it only displays whether an order is prepaid and reports earnings owed by us to the courier."*

**When this flips to Yes:** in-app courier payouts, a drawable wallet balance, card-based cash
reconciliation, or any payment-provider integration.

> `[ACTION REQUIRED]` `i18n/locales/en.json:418` already promises *"Go to the Earnings tab and tap
> 'Withdraw Funds'"* — a feature that **does not exist**: `app/(tabs)/finance.tsx` renders a
> withdrawable-balance card (`:121-129`) but no withdrawal control anywhere on the screen. Fix the FAQ
> string in all three locales, or build the feature. See §10.1. (`i18n/` is not owned by this document.)

### 9.4 Other App content declarations

| Declaration | Answer | Basis |
|---|---|---|
| News app | **No** | No editorial content. |
| COVID-19 contact tracing or status app | **No** | No health functionality. |
| Government app | **No** | Private commercial delivery service. |
| Health apps | **No** | — |
| Advertising ID | **No** | §9.2. Separate from the ads question; Console asks both. |
| Data safety | See §4 | — |
| Privacy policy URL | `[ACTION REQUIRED: https://your-domain.com/privacy]` | Mandatory for all apps. §10.2. |

---

## 10. Store listing policy constraints

### 10.1 What the description may not claim

Delivery and driver apps get elevated scrutiny because the category attracts fake gig-work listings and
recruitment scams. Assume a human reads your listing carefully.

**Do not write, because the code does not support it:**

- Anything about **in-app chat with customers or dispatch** — `app/chat.tsx:8-10` is a redirect; the
  feature does not exist.
- **"Withdraw your earnings instantly"** or similar. There is no withdrawal control in
  `app/(tabs)/finance.tsx`. `[ACTION REQUIRED: fix the "Withdraw Funds" FAQ string in all three
  locales, or build the feature.]` A reviewer who follows your own in-app instructions to a button that
  does not exist has found a deceptive-behaviour issue — and this one is a problem even if your listing
  never mentions withdrawal, because it is your app misdirecting the user.
- **Guaranteed earnings figures.** Play scrutinises income claims in gig-work listings hard. Describe
  the app, not hypothetical income.
- **Turn-by-turn navigation** as a feature of this app. The app hands off to Google Maps via
  `Linking.openURL`. Say "one-tap handoff to your navigation app", which is true and is exactly the
  behaviour your background-location justification depends on.

**Do write, because it is all verifiably true:**

- Receive delivery offers near you, with push notification alerts.
- See pickup and drop-off on a map with the route.
- Advance a delivery through picked up → in transit → delivered.
- Report a problem with a delivery to dispatch.
- Rate a completed delivery.
- Track your earnings by day, week, and month.
- Keep sharing your position with dispatch while you navigate in another app, with a persistent
  notification while you are on shift.
- Available in English, Russian, and Uzbek.

**Keyword spam rules.** No repeated keyword strings, no competitor names, no "#1 courier app", no
"Google" or "Play" in the title, no emoji or ALL-CAPS shouting in the title, no fake urgency. Title
≤ 30 chars, short description ≤ 80, full description ≤ 4000 — and the full description must read as
prose, not as a keyword list.

**The "this is a workforce app" framing helps you.** State plainly in the first line that ZBR Courier
is for couriers already working with ZBR. It sets the expectation that the app is login-gated (making
§3 coherent rather than suspicious) and heads off the "this looks like a job scam" reflex.

### 10.2 Privacy policy

Required, and the URL must be live before you submit — Play fetches it.

The in-app link is **environment-driven and currently hidden**. `app/onboarding.tsx:27`:

```ts
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
```

`:91-94` opens it, and `:165-166` renders the link **only when the variable is set** — so with it unset
there is no dead link and no `https://google.com` placeholder (an earlier draft of this pack described
exactly that; it is no longer true). What you get instead is an app with no visible privacy policy,
which Play will not accept.

> `[ACTION REQUIRED: publish a privacy policy, set `EXPO_PUBLIC_PRIVACY_URL` in the build shell, and
> paste the same URL into Play Console.]` Also set `EXPO_PUBLIC_TERMS_URL` if you have terms
> (`constants/config.ts:55` consumes it).

The policy must match §4 exactly: name every data type collected, state that **precise location is
collected in the background while the courier is online**, name Google/Firebase as the push and maps
service provider, name your routing host if you operate one, state retention periods, and link the
deletion route from §6.3. A privacy policy that contradicts the Data safety form is itself a violation —
the two are cross-checked.

### 10.3 Store listing assets

| Asset | Requirement | Note for this app |
|---|---|---|
| App name | ≤ 30 chars | "ZBR Courier" — matches `app.config.ts:50`. Keep them identical. |
| Short description | ≤ 80 chars | e.g. *"Delivery app for ZBR couriers: get orders, navigate, track your earnings."* |
| Full description | ≤ 4000 chars | See §10.1. |
| App icon | 512×512 PNG, 32-bit | `store-assets/play-icon-512.png` exists. The Console listing icon is a **separate upload** from the in-app launcher icon (`app.config.ts:54`, `./assets/images/icon.png`). |
| Feature graphic | 1024×500 PNG/JPG | `store-assets/feature-graphic-1024x500.png` exists. No text smaller than ~24pt; it is displayed small. |
| Phone screenshots | 2–8, longest side ≤ 2× shortest | **Do not include a blank grey map (§1.5) or an empty Available list.** Capture from the seeded demo account. Blur or fake customer names and phone numbers — real customer PII in a public listing is its own problem. |

Detailed listing copy and the screenshot runbook live in [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md).

---

## 11. Release tracks strategy

### 11.1 Recommended path

**Internal testing → Closed testing → Production.** Do not upload straight to Production.

> **Before you plan this at all, settle the developer-account question in
> [`PLAY_STORE_INDEX.md`](./PLAY_STORE_INDEX.md) §0.** If your Play developer account is **personal and
> was created on or after 13 November 2023**, closed testing is not a recommendation — it is a hard gate
> of **12 testers opted in continuously for 14 days** plus a production-access application Google
> reviews. That changes the schedule below from "a week of closed testing" to three weeks or more.

The argument in one line: **the background-location declaration is a manual human review attached to
your app, not to a specific track — so you want to discover a rejection while it costs you nothing.**

| Track | What you do | Why it matters here |
|---|---|---|
| **1. Internal testing** (up to 100 testers, live in minutes) | Upload the first AAB. Fill in **all** of App content: Data safety, Location permissions declaration + video, Foreground service declaration, App access, Content rating, Target audience, Privacy policy. Install on real devices covering Android 12, 13/14, and 15/16. | Internal testing publishes near-instantly, so the app is on devices while the human review runs in parallel. It is also where you catch what a reviewer would: the grey map, a missing `google-services.json`, the disclosure not appearing. **The pre-launch report** runs your app on Google's device farm and returns crashes, accessibility issues, and the 16 KB page-size warning. |
| **2. Closed testing** | Real couriers on real shifts. **≥12 testers for ≥14 continuous days if the §0 gate applies**; otherwise at least a week. | Background-location bugs are almost impossible to catch on a desk: doze mode, battery optimisation killing the foreground service, OEM-specific "aggressive battery saver" behaviour on the phones your couriers actually own. This is also your last chance to find that the demo account or seeded orders have quietly expired. |
| **3. Production** | Roll out **staged**, starting at **5%**, then 10 → 20 → 50 → 100, a day at each step. | Staged rollout lets you halt without pulling the release if the location service misbehaves at scale. Once a release is at 100% you cannot un-ship it — only ship a fix, which needs a fresh review cycle. (`ANDROID_RELEASE.md` specifies the same 5% ladder; use it.) |

**Sequencing tip:** get the location declaration **approved** while you are still in internal/closed
testing. Console shows its status under App content. Do not schedule the production launch until it
reads approved.

### 11.2 What requires a NEW review

| Change | Consequence |
|---|---|
| New AAB, same permissions, no new data collection | Normal review (hours to ~2 days). No new declaration. |
| **Any change to what the app collects or who receives it** — building chat, setting `EXPO_PUBLIC_CRASH_ENDPOINT`, adding a payment provider, pointing `EXPO_PUBLIC_ROUTING_URL` at a third party | **Data safety form must be updated before the release goes live.** A mismatch between the form and app behaviour is a policy violation, and Google audits it. |
| Adding, removing, or changing the use case of a **sensitive permission** — background location, a new foreground service type, media permissions | **New declaration and, for location and FGS, a new demo video.** Days. Plan around it. |
| **Changing the prominent disclosure copy or when it appears** | Re-record the video and resubmit the location declaration. Reviewers approved a specific flow — this is why §5.3 recommends leaving the copy alone. |
| Changing category, target age, or answering the content-rating questionnaire differently | **New content rating.** Issued fast, but the app can show as unrated in the interim. |
| Changing listing text, screenshots, or icon | Listing review, typically hours. Independent of the binary. |
| **Changing `applicationId`** | Not possible. It is a new app, new listing, zero installs. |
| Bumping `versionCode` | Required for every upload; Play rejects a duplicate outright. Declared at `app.config.ts:95` (`versionCode: 1`); increment for every AAB, including re-uploads of the same `version`. Since `android/` is generated output, that file is the only place the number is tracked. `scripts/bump-version.mjs` does it for you. |
| Losing the release keystore | Fatal without Play App Signing. **Enrol in Play App Signing when you create the app**, and keep the upload keystore backed up off the build machine. `[ACTION REQUIRED: generate the upload keystore, back it up, record the passwords in your password manager]` |

---

## 12. What will get you rejected — bluntly, for this app

Ranked by likelihood for ZBR Courier specifically.

**1. The reviewer cannot get in, or gets in and sees nothing.**
The modal failure for courier apps, and this app has three gates: login, a one-tap OTP path that a
reviewer cannot complete, and admin verification. Even a perfect demo account fails if the backend's
proximity filter hides all orders from a reviewer outside Tashkent, or if the seeded orders expired.
Test the exact flow yourself, from a clean install, on a device that has never run the app, from
outside your office network, before you submit. If you do only one thing from this document, do that.

**2. The background-location declaration is rejected because the video does not show what it must.**
The reviewer needs to see, in order: your disclosure → the system dialog → the app backgrounded while
tracking continues. Miss any link and it comes back. The code is in place (§5.1) and the disclosure
copy is compliant (§5.3) — so this is now purely a filming problem. Keep it under 30 seconds (§5.4).

**3. No web account-deletion URL.**
The in-app path is real and correct (§6.1), which makes this the *only* remaining deletion gap — and it
is a hard requirement, not a nice-to-have. Nothing in this repo can close it (§6.2).

**4. No privacy policy.**
`EXPO_PUBLIC_PRIVACY_URL` unset means the in-app link is hidden entirely (§10.2). Play requires the URL
in Console regardless, and fetches it.

**5. The map is a grey rectangle.**
`GOOGLE_MAPS_API_KEY` unset resolves to `""` (§1.5). This is a *map-centric delivery app*. A reviewer
opening the order screen to a blank map fails you for broken functionality — and simultaneously
disbelieves your background-location justification, because you claimed the map matters. Watch for the
subtler version: a key restricted to the upload-key SHA-1 only, which works locally and goes grey in
the Play build.

**6. You ship a developer client, or a microphone permission, in a production courier app.**
`expo-dev-client` is currently a production dependency and drags Google's code-scanner and ML Kit
barcode SDKs into the release AAB (§1.3) — third-party SDKs your Data safety form does not account for.
Separately, `RECORD_AUDIO` is blocked rather than absent (§1.8): the strip depends on a merge directive,
so verify it on the artifact rather than assuming. Nothing pulls a manual reviewer's attention faster
than a microphone permission on a delivery app.

**7. Push notifications do not work because `google-services.json` was missing at prebuild.**
`getDevicePushTokenAsync()` throws on Android without it, and the config only warns (§1.9). A reviewer
who grants notification permission and never sees the feature you described has found a broken app.

**8. The app will not start because `EXPO_PUBLIC_RORK_API_BASE_URL` was unset at bundle time.**
`constants/config.ts:78` throws at module load in a production build. This is safer than silently
targeting localhost, but it is a hard crash on first launch if you forget the env var (§1.4).

**9. Your own help centre sends the courier to buttons that do not exist.**
The "Withdraw Funds" FAQ (`i18n/locales/en.json:418`) and the "Settings > Security > Delete Account"
FAQ both describe UI that is not there — `/security` now redirects to Settings (§6.1) and there is no
withdrawal control (§9.3). Advertising or instructing toward unimplemented features is Deceptive
Behavior.

**10. Data safety understates what ships.**
If you answer from a `package.json` grep you will miss `firebase-messaging`,
`play-services-maps`, and `play-services-location` entirely (§1.3). Google cross-checks declarations
against observed network behaviour; getting caught understating collection is an enforcement category,
not a paperwork nit.

---

## 13. Pre-flight checklist

Print this. Tick every line before you press Publish.

**Environment and secrets (all set in the shell that runs prebuild + Gradle)**
- [ ] `GOOGLE_MAPS_API_KEY` set, key restricted to `app.zbr.courier` + the **Play app-signing** SHA-1
- [ ] `google-services.json` present at repo root (`ls -l google-services.json`) **before** prebuild
- [ ] `EXPO_PUBLIC_RORK_API_BASE_URL` set to an `https://` origin
- [ ] `EXPO_PUBLIC_ROUTING_URL` set to a routing host you operate
- [ ] `EXPO_PUBLIC_PRIVACY_URL` (and `EXPO_PUBLIC_TERMS_URL` if applicable) set
- [ ] `EXPO_PUBLIC_CRASH_ENDPOINT` — decided either way, and §4.2 matches the decision
- [ ] No `REPLACE_ME` left in any of the above (`constants/config.ts:60-71` throws if there is)

**Code and build**
- [ ] `expo-dev-client` moved to `devDependencies` (or removed); no `devlauncher`/`devmenu`/`mlkit`/`codescanner` entries in the AAB — §1.3
- [ ] `rm -rf android && npx expo prebuild --platform android --clean` run fresh
- [ ] `grep applicationId android/app/build.gradle` → `app.zbr.courier`
- [ ] `grep -c ACCESS_BACKGROUND_LOCATION android/app/src/main/AndroidManifest.xml` → ≥ 1
- [ ] `aapt2 dump permissions` on the built artifact shows **no** `RECORD_AUDIO`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `SYSTEM_ALERT_WINDOW`, `CAMERA`, `READ_MEDIA_IMAGES`, `AD_ID` — §1.8
- [ ] Every `.so` LOAD segment aligns to `0x4000` or greater (§1.2)
- [ ] Signer is **not** `CN=Android Debug`
- [ ] `versionCode` strictly greater than anything ever uploaded (`node scripts/bump-version.mjs`)
- [ ] Upload keystore backed up off-machine; Play App Signing enrolled
- [ ] Delete Account tested end-to-end on a throwaway account (§6.1)
- [ ] Disclosure modal appears **before** the permission dialog on a clean install, in all three locales
- [ ] "Withdraw Funds" and "Settings > Security > Delete Account" FAQ strings corrected in en/ru/uz
- [ ] `SUPPORT_EMAIL` / `SUPPORT_PHONE` (`constants/config.ts:270-271`) are real and monitored

**Play Console — App content**
- [ ] App access: demo account added, tested on a clean install from outside your network, notes tell the reviewer to ignore the phone-login button
- [ ] Data safety: every row of §4 transcribed; encryption-in-transit answered Yes honestly
- [ ] Data deletion URL live and reachable in an incognito window
- [ ] Location permissions declaration submitted, ≤30 s video URL verified in incognito
- [ ] Foreground service permissions declaration submitted (`location` type)
- [ ] Content rating questionnaire completed
- [ ] Target audience: 18+ only
- [ ] Ads: No · Advertising ID: No · News: No · COVID: No · Government: No · Financial features: No
- [ ] Privacy policy URL entered

**Release**
- [ ] Internal testing release installed and exercised on Android 12, 14, and 16 devices
- [ ] Pre-launch report reviewed; no 16 KB page-size warning
- [ ] Closed test run per §0 of the index (≥12 testers / ≥14 days if the personal-account gate applies)
- [ ] Location declaration shows **approved** in Console
- [ ] Production rollout started staged at **5%**

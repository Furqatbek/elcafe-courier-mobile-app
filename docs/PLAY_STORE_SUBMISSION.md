# ZBR Courier — Google Play Production Submission Pack

**App:** ZBR Courier · **Package / applicationId:** `app.zbr.courier` · **Stack:** Expo SDK 54 / React Native 0.81.5 / expo-router
**Distribution model:** local `npx expo prebuild` + Gradle → AAB uploaded **manually** to Play Console. EAS is not used.
**Purpose of this document:** every Play Console form you must fill, answered for *this* app, derived from *this* codebase, so you can copy answers in without guessing.

---

## 0. How to read this document

Every factual claim below has a file:line citation into this repo. Claims were verified by reading the code and running the commands shown, on the date this file was written.

Three kinds of marker appear:

| Marker | Meaning |
|---|---|
| `[ACTION REQUIRED: …]` | A genuine human decision or secret. You must supply it; nothing in the code can. |
| `[BLOCKER]` | Will get the app rejected, blocked, or visibly broken in review. Fix before uploading. |
| `[RE-VERIFY]` | The repo is under active edit by multiple agents. Re-run the stated command before you submit; the answer may have changed since this was written. |

**Where native config comes from.** This repo contains **both** `app.json` and `app.config.ts`. Expo resolves the dynamic config last and it wins — verified by running `npx expo config --type prebuild --json`, whose output matches `app.config.ts` exactly (`origin: false`, `updates.enabled: false`, `icon: ./assets/images/icon.png`) and contains **none** of `app.json`'s distinct values (no `SCHEDULE_EXACT_ALARM`, no `RECEIVE_BOOT_COMPLETED`, no `splash` block). The resolved output confirms it:

```json
"_internal": {
  "dynamicConfigPath": "/home/user/elcafe-courier-mobile-app/app.config.ts",
  "staticConfigPath":  "/home/user/elcafe-courier-mobile-app/app.json"
}
```

**`app.json` is now dead weight and is actively misleading** — it still lists `SCHEDULE_EXACT_ALARM` and a different icon. `[ACTION REQUIRED: delete app.json, or reduce it to `{}`, so nobody audits the wrong file.]` Everywhere below, "the config" means `app.config.ts`, and the authoritative permission list is the `npx expo config --type prebuild --json` output, not either file read by eye.

**Policy dates move. Re-check, do not trust this file for deadlines.** The three pages that actually govern you:

- Target API level requirement — <https://support.google.com/googleplay/android-developer/answer/11926878>
- Location permissions policy (background location + the demo video) — <https://support.google.com/googleplay/android-developer/answer/9799150>
- Data safety form — <https://support.google.com/googleplay/android-developer/answer/10787469>

Play Console itself is authoritative: **Policy → App content** lists every declaration your build actually triggers. If Console asks for a declaration this document does not mention, Console is right and this document is stale.

---

## 1. Verified facts about this build

These are the load-bearing facts. Evidence is quoted, not summarised.

### 1.1 Target API level, min SDK, architectures

React Native 0.81.5 ships the Gradle version catalog that Expo's root-project plugin reads:

```
$ grep -n "Sdk" node_modules/react-native/gradle/libs.versions.toml
3:minSdk = "24"
4:targetSdk = "36"
5:compileSdk = "36"
```

Expo's autolinking plugin consumes that catalog, falling back to 35 only if the catalog is absent:

```
node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/
  src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt:30
  val targetSdk = extra.setIfNotExist("targetSdkVersion") {
    Integer.parseInt(versionCatalogs.getVersionOrDefault("targetSdk", "35")) }
```

and `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle:69` independently defaults Expo modules to `targetSdkVersion … 36`.

`app.config.ts` additionally pins these explicitly rather than inheriting them, which is the right call — it makes the level auditable and immune to a dependency bump:

```ts
['expo-build-properties', { android: {
  compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 24, buildToolsVersion: '36.0.0',
}}]
```

Confirmed present in the resolved config output.

**So a clean prebuild of this app targets API 36 (Android 16), minSdk 24, and is ahead of the current Play requirement.** Because the value is now pinned in `app.config.ts`, it is also the value you must *raise by hand* each year — the RN catalog will no longer carry you forward. Put a calendar reminder against the target-API page.

*How to re-check the requirement:* open the target API level page above; it states the API level required for new apps/updates and the date it takes effect. Play Console also refuses the upload with an explicit error naming the required level, so an upload attempt is itself a valid check.

Architectures built (`android/gradle.properties`):

```
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

### 1.2 16 KB page size

Google Play requires apps targeting Android 15+ to support 16 KB memory page sizes for new submissions and updates from a date stated on <https://developer.android.com/guide/practices/page-sizes>. React Native 0.81 and Expo SDK 54 ship 16 KB-aligned native libraries by default, so a stock prebuild should pass — **but verify your actual AAB rather than trusting that**, because a stray third-party `.so` will fail you:

```bash
# After building the AAB, unzip it and check every native library's alignment.
cd /home/user/elcafe-courier-mobile-app
unzip -o -q android/app/build/outputs/bundle/release/app-release.aab -d /tmp/aab-check
find /tmp/aab-check -name '*.so' -print0 | xargs -0 -I{} sh -c \
  'echo "== {}"; $ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf -l "{}" | grep -A1 LOAD | head -4'
# Every LOAD segment Align must be 0x4000 (16384) or larger. 0x1000 (4096) fails.
```

Play Console also surfaces this on the release page as a pre-launch warning. If Console shows no 16 KB warning on your internal-testing release, you are clear.

### 1.3 No advertising, analytics, or crash-reporting SDKs

```
$ grep -iE "admob|google-mobile-ads|facebook|applovin|unity-ads|ironsource|appsflyer|adjust|amplitude|mixpanel|segment|sentry|bugsnag|firebase|analytics|crashlytics" package.json
NO MATCHES: no ad/analytics/crash SDK in package.json dependencies
```

Confirmed in code: `constants/config.ts` sets `ENABLE_ANALYTICS: false` in `FEATURE_FLAGS`. There is **no `lib/crashReporting.ts`** in the tree and no reference to `EXPO_PUBLIC_CRASH_ENDPOINT` anywhere:

```
$ grep -rn "EXPO_PUBLIC_CRASH_ENDPOINT\|crashReporting" --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules
(no output)
```

Error handling today is `console.error` only (e.g. `context/CourierContext.tsx:1340`, `services/pushNotification.ts:66`) plus a local `components/ErrorBoundary.tsx`. Nothing leaves the device.

> `[RE-VERIFY]` Another agent may be adding crash reporting. Before filling the Data safety form, re-run:
> ```bash
> ls lib/crashReporting.ts 2>/dev/null; grep -rn "EXPO_PUBLIC_CRASH_ENDPOINT" --include="*.ts" --include="*.tsx" . | grep -v node_modules
> ```
> If either returns output, flip **Crash logs → Collected: Yes** in §3 and add the crash endpoint's operator to the "shared with" reasoning.

### 1.4 Transport security — the app does **not** enforce TLS today

`constants/config.ts:2`:

```ts
export const BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:8080';
```

There is no scheme validation, no `https://` coercion, and no cleartext block. `services/websocket.ts:95-102` derives the STOMP URL from `BASE_URL` and will happily produce `ws://` if `BASE_URL` is `http://`. `app.config.ts` additionally sets iOS `NSAllowsArbitraryLoads: true` (already annotated there as `[ACTION REQUIRED]` for the iOS submission; it does not affect Android).

On Android this is *partly* saved by the platform: apps targeting API 28+ have `cleartextTrafficPermitted=false` by default, so a production build pointed at an `http://` host will simply fail to connect rather than transmit in the clear. That is a broken app, not a safe one.

> `[BLOCKER]` Two things must be true at build time:
> 1. `EXPO_PUBLIC_RORK_API_BASE_URL` is set to an **`https://`** URL in the shell that runs the Gradle build (Expo inlines `EXPO_PUBLIC_*` at bundle time — it is baked into the JS bundle, not read at runtime).
> 2. You can honestly answer "Yes" to Data safety's *"Data is encrypted in transit"*.
>
> Verify the value actually got baked in, after building:
> ```bash
> npx expo export --platform android --output-dir /tmp/zbr-export
> grep -o 'https\?://[a-zA-Z0-9._:-]*' /tmp/zbr-export/_expo/static/js/android/*.js | sort -u | head -20
> ```
> If `localhost:8080` appears in that output, the env var was not set when you bundled.
>
> `[RE-VERIFY]` If another agent has since added scheme enforcement to `constants/config.ts`, quote that code in your Data safety justification instead. Check with:
> ```bash
> grep -n "https\|startsWith\|__DEV__" constants/config.ts | head
> ```

### 1.5 Google Maps will render blank in the release build

`components/OrderMap.native.tsx:3` imports `PROVIDER_DEFAULT` from `react-native-maps`; on Android the default (and only) provider is the Google Maps SDK, which requires a `com.google.android.geo.API_KEY` manifest meta-data entry. Expo's plugin sources that key from `android.config.googleMaps.apiKey` and **removes the meta-data entirely when it is absent**:

```
node_modules/@expo/config-plugins/build/android/GoogleMapsApiKey.js:26
function getGoogleMapsApiKey(config) {
  return config.android?.config?.googleMaps?.apiKey ?? null;
}
… else { removeMetaDataItemFromMainApplication(mainApplication, META_API_KEY); }
```

`app.config.ts` has no `android.config` block at all — verified in the resolved config, whose `android` object contains `package`, `versionCode`, `adaptiveIcon`, `allowBackup`, `permissions`, and `blockedPermissions`, and no `config` key.

> `[BLOCKER]` `[ACTION REQUIRED: obtain a Google Maps SDK for Android API key, restrict it to package `app.zbr.courier` + your release signing SHA-1, and add it to `app.config.ts` as `android.config.googleMaps.apiKey`]`. Without this the map on the order and navigation screens is a grey rectangle. A reviewer opening a courier app whose map does not render will fail it on broken functionality, and your background-location justification ("we show the courier their route") becomes unprovable on video.

### 1.6 The `android/` directory is generated output and is currently stale

`android/` was regenerated at some point during this work and now carries the right identity:

```
$ grep -n "applicationId\|namespace\|versionName" android/app/build.gradle
90:    namespace 'app.zbr.courier'
92:        applicationId 'app.zbr.courier'
96:        versionName "1.0.0"
```

**But its manifest predates `app.config.ts`** and still contains permissions that config now blocks:

```
$ grep -o 'android:name="android.permission.[A-Z_]*"' android/app/src/main/AndroidManifest.xml | sort -u
… ACCESS_BACKGROUND_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION,
   FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, FOREGROUND_SERVICE_MEDIA_PLAYBACK,
   INTERNET, MODIFY_AUDIO_SETTINGS, READ_EXTERNAL_STORAGE, RECORD_AUDIO,
   SCHEDULE_EXACT_ALARM, SYSTEM_ALERT_WINDOW, VIBRATE, WRITE_EXTERNAL_STORAGE
```

> `[RE-VERIFY]` `android/` is generated output, not source. Regenerate it immediately before every release build so the current config actually applies, then check the result:
> ```bash
> cd /home/user/elcafe-courier-mobile-app
> npx expo prebuild --platform android --clean
> grep -n 'applicationId' android/app/build.gradle                                   # app.zbr.courier
> grep -c 'ACCESS_BACKGROUND_LOCATION' android/app/src/main/AndroidManifest.xml      # >= 1
> grep -c 'RECORD_AUDIO.*tools:node="remove"' android/app/src/main/AndroidManifest.xml # >= 1
> ```
> The applicationId is permanent once published — uploading a bundle under the wrong package name burns that name on your Play account forever and cannot be renamed. Check it every time.

### 1.7 Authoritative permission list

Neither config file is the answer; three layers combine. Resolved config (`npx expo config --type prebuild --json`) gives layer one and two:

```json
"permissions": ["android.permission.ACCESS_COARSE_LOCATION","android.permission.ACCESS_FINE_LOCATION",
  "android.permission.VIBRATE","android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE","android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.MODIFY_AUDIO_SETTINGS","android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE","android.permission.INTERNET"],
"blockedPermissions": ["android.permission.RECORD_AUDIO",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK","android.permission.SCHEDULE_EXACT_ALARM"]
```

Layer three is **library manifests, merged by Gradle at build time** — these never appear in `android/app/src/main/AndroidManifest.xml`, only in the built artifact:

| Library | Adds at merge time |
|---|---|
| `expo-notifications` | `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` (`node_modules/expo-notifications/android/src/main/AndroidManifest.xml`) |
| `expo-image-picker` | `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` — **notably not `READ_MEDIA_IMAGES`**; it registers the Android Photo Picker `ModuleDependencies` service instead |
| `expo-location` | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` |
| `expo-audio` | `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` — see §1.8 |

The image-picker row matters: because no `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` is declared, **you do not need Play's Photo and Video Permissions declaration**. Confirm on your real bundle before relying on it:

```bash
# Requires Android SDK build-tools + bundletool
bundletool build-apks --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=/tmp/zbr.apks --mode=universal
unzip -p /tmp/zbr.apks universal.apk > /tmp/zbr-universal.apk
$ANDROID_HOME/build-tools/*/aapt2 dump permissions /tmp/zbr-universal.apk
```

Anything in that output is what Play sees. If `READ_MEDIA_IMAGES` appears, you have acquired a Photo and Video Permissions declaration obligation — go back to §6.

### 1.8 The microphone permission `expo-audio` tries to add — already handled, verify it stuck

`services/soundService.ts` was migrated from `expo-av` to `expo-audio` (`:12` — `import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'`) purely to **play** a new-order alert. But `expo-audio` requests the microphone by default:

```
node_modules/expo-audio/plugin/build/withAudio.js:6
const withAudio = (config, { microphonePermission, recordAudioAndroid = true, … } = {}) => {
…:24   recordAudioAndroid !== false && 'android.permission.RECORD_AUDIO',
```

and its **library manifest declares it unconditionally**, so the plugin option alone is not enough:

```
node_modules/expo-audio/android/src/main/AndroidManifest.xml
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

`app.config.ts` correctly does **both** things needed — sets `recordAudioAndroid: false` on the plugin *and* lists `RECORD_AUDIO` plus `FOREGROUND_SERVICE_MEDIA_PLAYBACK` in `android.blockedPermissions`, which is the only mechanism that emits the `tools:node="remove"` merge directive (`node_modules/@expo/config-plugins/build/android/Permissions.js:48-55`). Both are present in the resolved config, quoted in §1.7.

**Why this mattered enough to spell out:** a courier app shipping `RECORD_AUDIO` would have to declare microphone access on its Play listing, answer for it in Data safety, and defend a permission it never uses — a near-certain rejection. `FOREGROUND_SERVICE_MEDIA_PLAYBACK` would have separately dragged in a second Foreground service permissions declaration (§7.2). Verify with the `aapt2 dump permissions` command above that **neither appears in the built bundle**; the merge directive is the only thing standing between you and both problems.

**`SYSTEM_ALERT_WINDOW` is also handled — and it had to be.** It comes from the bare prebuild template's own manifest, and Expo's permission plugin **only adds, never removes**: `node_modules/@expo/config-plugins/build/android/Permissions.js:113-129` shows `setAndroidPermissions` iterating `permissionsToAdd` and calling `addPermissionToManifest`, with no removal path. Blocking is the only mechanism that strips it. Verified present in the resolved config's `blockedPermissions`.

**Verified resolved permission state** (`npx expo config --type prebuild --json`, run against the current tree):

```
PERMISSIONS:                              BLOCKED (emitted as tools:node="remove"):
  ACCESS_COARSE_LOCATION                    RECORD_AUDIO
  ACCESS_FINE_LOCATION                      FOREGROUND_SERVICE_MEDIA_PLAYBACK
  POST_NOTIFICATIONS                        SCHEDULE_EXACT_ALARM
  VIBRATE                                   SYSTEM_ALERT_WINDOW
  ACCESS_BACKGROUND_LOCATION
  FOREGROUND_SERVICE
  FOREGROUND_SERVICE_LOCATION
  MODIFY_AUDIO_SETTINGS
  READ_EXTERNAL_STORAGE
  WRITE_EXTERNAL_STORAGE
  INTERNET
```

This is a clean list for a courier app: every entry maps to a feature (§7), and the four risky injected permissions are stripped. The remaining `MODIFY_AUDIO_SETTINGS` (from `expo-audio`) is a normal, non-dangerous permission that never surfaces to the user — leaving it is fine.

### 1.9 Push tokens: the code does not match the stated distribution model

Your backend sends through Firebase Admin with its own keys, which requires a **raw FCM registration token**. The app requests an **Expo push token**:

```
$ grep -n "getDevicePushTokenAsync\|getExpoPushTokenAsync" services/pushNotification.ts
63:    const tokenData = await Notifications.getExpoPushTokenAsync({
```

`services/pushNotification.ts:63-65`:

```ts
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
});
```

Two problems. First, this returns an `ExponentPushToken[…]` string, which is routed by Expo's push service — Firebase Admin cannot send to it, so `POST /api/v1/device-tokens` stores a token the backend can never use. Second, with EAS removed there is no Expo project, and `EXPO_PUBLIC_PROJECT_ID` is unset, so the call throws and `getPushToken` returns `null` via the catch at `:68` — meaning `registerDeviceToken` logs *"No push token available to register"* and returns `false` (`:82-85`) and **no token is ever registered at all**.

> `[BLOCKER]` `[RE-VERIFY]` New order offers arrive by push (`app/_layout.tsx` handles `NEW_DELIVERY_AVAILABLE`); this is the app's headline feature and it is currently dead. The fix is `Notifications.getDevicePushTokenAsync()`, which returns the native FCM token on Android. Re-check with the grep above before you build — another agent may have already changed it. Also confirm `google-services.json` is at the repo root, since `app.config.ts:34-36` silently omits `googleServicesFile` when the file is missing and only prints a console warning:
> ```
> [app.config] ./google-services.json not found - building without Firebase.
> Push notifications will NOT work in this build.
> ```
> That warning scrolls past in a long prebuild log. Check for the file explicitly: `ls -l google-services.json`.

---

## 2. Pre-submission blockers checklist

Ordered by how likely each one is to actually stop *this* app. Work top-down.

| # | Blocker | Why it bites this app | Where |
|---|---|---|---|
| 1 | **No reviewer demo account** | Reviewers hit `app/login.tsx` and cannot get past it. Worse, even with credentials they land on `app/verification-pending.tsx` unless the account is pre-verified server-side. This is the single most common rejection for driver/courier apps. | §2 below, §4 |
| 2 | **Background-location declaration + demo video missing or thin** | `ACCESS_BACKGROUND_LOCATION` is in the resolved config. Play routes it to a manual human review with a mandatory video. Rejections here cost days per round-trip. | §5 |
| 3 | **In-app account deletion is a stub that lies to the user** | `app/security.tsx:138-156` shows *"Your account deletion request has been submitted"* and calls **no API**. That is both a missing-deletion violation and a deceptive-behaviour violation. | §6 |
| 4 | **No account-deletion web URL** | Play requires a publicly reachable URL in addition to the in-app path. Nothing in this repo hosts one. | §6 |
| 5 | **Privacy policy link points at `https://google.com`** | `app/onboarding.tsx:79` — `Linking.openURL('https://google.com')`. A reviewer who taps "Privacy Policy" and lands on Google's homepage will fail the app. | §10 |
| 6 | **No Google Maps API key → blank map** | Reviewer sees a grey rectangle where the delivery map should be, in a map-centric delivery app. | §1.5 |
| 7 | **Push is wired to Expo's push service, not FCM** | `services/pushNotification.ts:63` calls `getExpoPushTokenAsync` with an unset `projectId`. It throws, no token registers, and Firebase Admin could not send to that token anyway. New order offers — the app's headline feature — never arrive. | §1.9 |
| 8 | **`BASE_URL` may bake in `http://localhost:8080`** | App is dead on arrival for the reviewer, and you cannot truthfully claim TLS in Data safety. | §1.4 |
| 9 | **Precise location is transmitted to a third-party host** | `lib/routing.ts:48` posts courier + destination coordinates to `https://router.project-osrm.org`. This must be disclosed as sharing, or removed. | §4, §12 |
| 10 | **`google-services.json` not in the repo** | `app.config.ts` silently omits Firebase and only warns to the console when the file is absent. Without it, push is dead even after fixing #7. | §1.9 |
| 11 | **Contact details are placeholders** | `constants/config.ts` `SUPPORT_EMAIL: 'support@courierapp.com'`, `SUPPORT_PHONE: '+998901234567'`. `app/verification-pending.tsx:34-38` opens both. A reviewer emailing a dead address during app-access review will fail you. | §3 |
| 12 | **Order rating and chat are simulated, not wired** | `app/order-rating/[orderId].tsx:85` (`await new Promise(resolve => setTimeout(resolve, 1500))`) and `app/chat.tsx:97` fake their responses. If your store listing advertises chat or ratings, that is a misrepresentation. Either wire them or don't mention them. | §10 |
| 13 | **Stale `android/` build from before `app.config.ts`** | The directory on disk still carries `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM`, and `SYSTEM_ALERT_WINDOW`. Building without re-running prebuild ships all three. | §1.6 |
| 14 | **`app.json` still exists alongside `app.config.ts`** | It is ignored at build time but lists different permissions and a different icon. Anyone auditing it — including you, in six months — reads the wrong file. | §0 |

---

## 3. App access instructions — the most important section

### 3.1 Why this app is high-risk here

A Play reviewer is a person in a Google office with a test device and no relationship to your business. For ZBR Courier they hit **three** walls:

1. **Login wall.** `app/index.tsx` redirects to `/onboarding`, which redirects to `/login` (`app/onboarding.tsx:73-75`). Nothing in the app is reachable unauthenticated.
2. **OTP wall.** A phone-OTP route exists (`app/login-otp.tsx`, endpoints `AUTH.PHONE_REQUEST_OTP` / `PHONE_VERIFY_OTP` in `constants/config.ts:26-27`). **A reviewer cannot receive an SMS on your Uzbek number.** If OTP were the only path, the app would be unreviewable.
3. **Admin-verification wall.** `app/_layout.tsx:39-47`:
   ```ts
   const isVerified = courierProfile?.verified === true ||
     courierProfile?.verificationStatus === 'approved';
   const needsVerification = courierProfile && !isVerified;
   if (needsVerification && !inVerificationScreen) {
     router.replace('/verification-pending');
   }
   ```
   A freshly-registered courier is bounced to `app/verification-pending.tsx` — a dead-end screen offering only "call / email / chat support" and "log out". A reviewer landing there sees an app with no functionality, cannot self-approve, and will reject for "we were unable to access the app's functionality."

**Good news, verified:** `app/login.tsx` is a pure **email + password** form — `useState('')` for `email` and `password`, submitted via `login(email, password)` (line 28), and the screen offers *no* link to `/login-otp`:

```
$ grep -rn "login-otp" --include="*.tsx" app
app/_layout.tsx:33  (route registration only)
app/_layout.tsx:81  (Stack.Screen only)
```

So the OTP route is registered but unreachable from the login UI. **Reviewers can use email/password and never touch OTP.** Say exactly that in your App access notes.

### 3.2 What the team must provision before submitting

`[ACTION REQUIRED]` — all of the following are server-side actions someone on your team must perform. None of them can be done from this repo.

1. **A permanent demo courier account** with a real email and password. Not a trial, not time-limited, not rate-limited, no forced password rotation. Play re-reviews on every update and on policy sweeps for the life of the app; if the account dies six months from now, a future update gets blocked.
   - Suggested: `play-review@<your-domain>` — an address on a domain you control, so you also receive any reviewer correspondence.
2. **Server-side pre-verification.** The account's courier profile must return `verified: true` from `GET /api/v1/couriers/me` so `app/_layout.tsx:40` routes it to `/(tabs)/orders` instead of `/verification-pending`. Verify by logging in with the demo credentials on a clean install and confirming you land on the Orders tab.
3. **Seeded test orders.** `app/(tabs)/orders.tsx:318` renders `data={isOnline ? availableOrders : []}` — the Available list is empty unless the courier is online *and* the backend returns offers. A reviewer who toggles online and sees an empty list has nothing to evaluate, and — critically — **you cannot demonstrate the background-location use case** required by §5. Seed at least:
   - 2–3 offers on `GET /api/v1/couriers/me/available-orders` that persist (don't expire in 5 minutes; `ORDER_CONFIG.NEW_ORDER_TIMEOUT` is 300000 ms) and are near the demo device, or with the backend's proximity filter relaxed for this account.
   - 1 accepted/active order so the reviewer can walk the `READY → PICKED_UP → IN_TRANSIT → DELIVERED` flow (`constants/config.ts` `ORDER_STATUS`).
   - Non-empty earnings on `GET /api/v1/couriers/me/earnings` so the Finance tab isn't blank.
4. **Geographic tolerance.** Reviews are typically performed from outside Uzbekistan. If the backend filters offers by courier proximity to Tashkent (`MAP_CONFIG.DEFAULT_REGION` is 41.2995, 69.2401), the demo account must be exempted from that filter or offers must be pinned near the reviewer. This is the quiet killer: the account works, the login works, and the reviewer still sees an empty app.
5. **A reachable support email.** Replace `APP_CONFIG.SUPPORT_EMAIL` (`constants/config.ts` — currently `support@courierapp.com`) with a monitored address, and use the same one as the Play Console listing contact email.

### 3.3 Ready-to-paste App access form entry

Play Console → **App content → App access** → choose **"All or some functionality is restricted"** → add one instruction set.

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
> LOGIN
> 1. Install and open the app.
> 2. Swipe through or tap "Skip" on the 4 onboarding screens.
> 3. On the login screen enter:
>      Email:    [ACTION REQUIRED: play-review@your-domain.com]
>      Password: [ACTION REQUIRED: reviewer password]
>    and tap Log in.
> 4. This account is already approved by our operations team, so you go
>    straight to the Orders screen. You will NOT see the "verification
>    pending" screen and you do NOT need an SMS code.
>
> NO SMS / OTP IS REQUIRED. The login screen shown above uses email and
> password only. The app also has a phone + SMS code login for real couriers,
> but it is not reachable from the login screen and you never need it.
>
> WHAT TO DO NEXT (this exercises every feature, including background location)
> 5. On the Orders screen, tap the toggle switch in the top-right to go ONLINE.
>    - The app asks for location permission. Before the Android system dialog
>      appears, the app shows its own explanation screen describing what
>      location is used for, including while the app is in the background.
>    - Grant "While using the app", then grant "Allow all the time" when the
>      app requests background access.
> 6. The "Available" tab now lists test delivery offers we have seeded on this
>    account. Tap any offer to see pickup and drop-off details on the map.
> 7. Tap "Accept" to take the delivery. It moves to the "Active" tab.
> 8. Open the active order and use the status buttons to advance it:
>    Picked up -> In transit -> Delivered.
> 9. Tap "Navigate" to see how the app hands off to Google Maps. This is the
>    situation background location exists for: the courier is driving inside
>    Google Maps while our dispatch system needs the live position to update
>    the customer's tracking screen.
> 10. The Finance tab shows seeded earnings for this account.
> 11. Settings -> Security contains in-app account deletion.
>
> SUPPORT
> If the account stops working or the test orders are missing, email
> [ACTION REQUIRED: support@your-domain.com] and we will restore them same day.
> ```

**Do not tick "All functionality is available without special access".** It is false here and produces an immediate rejection when the reviewer hits the login screen.

---

## 4. Data safety form — complete answer sheet

Play Console → **App content → Data safety**. Transcribe field by field.

### 4.1 Top-level questions

| Console question | Answer for ZBR Courier | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Location, account data, and device tokens are transmitted to your backend. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — *conditional* | Only true once `EXPO_PUBLIC_RORK_API_BASE_URL` is an `https://` URL at bundle time. See §1.4. If you ship an `http://` base URL, the honest answer is **No**, and that answer will cost you. Fix the URL; answer Yes. |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Required — see §6. You must supply both the in-app path and the web URL. |
| Has your app been independently validated against a global security standard? | **No** | Optional badge; you have no such audit. Leaving it No has no penalty. |

### 4.2 Data type answer table

For each row Console asks, in order: *Collected? · Shared? · Processed ephemerally? · Required or optional? · Purposes?*

"Shared" in Play's sense = transferred to a third party. Data sent to **your own** backend (`BASE_URL`) is *collection*, not sharing.

| Data type (Console category → type) | Collected | Shared | Ephemeral | Required/Optional | Purposes | Code evidence |
|---|---|---|---|---|---|---|
| **Location → Precise location** | **Yes** | **Yes** — see note A | **No** (persisted server-side) | **Required** | App functionality | `context/CourierContext.tsx:1372-1387` `Location.watchPositionAsync({ accuracy: Location.Accuracy.High, … })` → `updateLocationOnServer(...)` at `:1320-1341` `PUT /api/v1/couriers/me/location` with `{latitude, longitude, accuracy, heading, speed}`. Persisted: `CourierProfile.currentLat/currentLng` (`services/api.ts:71-72`). |
| **Location → Approximate location** | **Yes** | **Yes** — note A | No | Required | App functionality | `ACCESS_COARSE_LOCATION` in the resolved config and in `node_modules/expo-location/android/src/main/AndroidManifest.xml`. If a courier grants "Approximate only", the same `PUT` still runs with coarsened coordinates. Declare it. |
| **Personal info → Name** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:112-113` posts `firstName`, `lastName` to `/api/v1/auth/register`. Displayed at `app/(tabs)/settings.tsx:52-53`. |
| **Personal info → Email address** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:114`; login credential at `app/login.tsx:28`. |
| **Personal info → Phone number** | **Yes** | No | No | **Required** | App functionality, Account management | `app/register.tsx:115`; also the OTP identifier — `AUTH.PHONE_REQUEST_OTP` (`constants/config.ts:26`). |
| **Personal info → User IDs** | **Yes** | No | No | Required | App functionality, Account management | Backend `User.id` and `CourierProfile.id` (`services/api.ts:35,64-65`), cached at `context/CourierContext.tsx:1197` (`TOKEN_CONFIG.USER_KEY`). |
| **Personal info → Other info** (driver's licence number, vehicle registration plate, vehicle type) | **Yes** | No | No | **Required** to become a courier | App functionality, Account management, **Fraud prevention, security and compliance** | `app/become-courier.tsx:70-75` posts `{vehicleType, vehicleNumber, licenseNumber, preferredRadiusKm}` to `/api/v1/couriers/register`. Describe it in the free-text box as: *"Driving licence number and vehicle registration plate, collected once to verify the courier is legally permitted to make deliveries."* |
| **Photos and videos → Photos** | **Yes** | No | No | **Optional** | App functionality, **Customer support** | `app/report-issue.tsx:120-124` — up to 3 photos, base64-encoded (`:75`, `:99`), sent with `api.orders.reportIssue`. Note B covers the profile picture. |
| **Device or other IDs** | **Yes** | No | No | Required | App functionality | `services/pushNotification.ts:88-101` posts `{deviceToken, deviceType, appVersion}` to `POST /api/v1/device-tokens`. Cached locally at `:103`. |
| **App activity → Other user-generated content** (issue description free text) | **Yes** | No | No | **Optional** | App functionality, Customer support | `app/report-issue.tsx:122` sends `description: description.trim()` — free text the courier types about a delivery problem. |
| **Messages → Other in-app messages** | **No** | — | — | — | — | `app/chat.tsx` is entirely local: `sendMessage` appends to component state and fakes a reply with `setTimeout(…, 1500)` at `:98-108`. Nothing is transmitted. **If chat is ever wired to the backend, this row flips to Yes.** |
| **App info and performance → Crash logs** | **No** | — | — | — | — | No crash SDK; no `lib/crashReporting.ts`; no `EXPO_PUBLIC_CRASH_ENDPOINT`. See §1.3 and its `[RE-VERIFY]`. |
| **App info and performance → Diagnostics** | **No** | — | — | — | — | Same as above. `console.error` only. |
| **App activity → App interactions** | **No** | — | — | — | — | No analytics SDK; `FEATURE_FLAGS.ENABLE_ANALYTICS: false` in `constants/config.ts`. |
| **Financial info** (any subtype) | **No** | — | — | — | — | See §9.3. The app *displays* earnings (`app/(tabs)/finance.tsx`) and a `CASH` payment badge (`app/order/[id].tsx:248`) but collects no payment instrument and processes no transaction. |
| **Personal info → Address** | **No** | — | — | — | — | Delivery addresses shown to the courier are the *customer's*, received from your backend for display (`app/order/[id].tsx:71-74`). Data safety covers data collected **from the app's user**; the courier's own address is never asked for. |
| **Health / Fitness / Contacts / Calendar / SMS / Audio / Files / Web browsing** | **No** | — | — | — | — | No such APIs in the codebase. |

#### Note A — the third-party location transfer you must not overlook

`lib/routing.ts:46-49`:

```ts
const response = await fetch(
  `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`
);
```

Called from `components/OrderMap.native.tsx:84` and `:98` and `components/OrderMap.tsx:129,132`. **This sends the courier's live coordinates and the customer's delivery coordinates to `router.project-osrm.org`** — the public OSRM demo server, which is not your infrastructure and is not a contracted service provider under Play's service-provider exemption.

You have two honest options, and you must pick one before filing the form:

- **Option 1 (recommended): remove the dependency.** Route through your own backend, or use the Google Directions API under your own key. Then answer **Shared: No** for both location rows, and this section gets much simpler. `[ACTION REQUIRED: decide and implement]`
- **Option 2: keep it and disclose.** Answer **Shared: Yes** for Precise and Approximate location, purpose **App functionality**, and name the recipient in your privacy policy: *"To draw the delivery route we send the pickup and drop-off coordinates to the OpenStreetMap-based routing service router.project-osrm.org."* Note this is a free public demo endpoint with no SLA and no data-processing agreement — a poor fit for a production courier app on both privacy and reliability grounds.

The soundService fallback (`services/soundService.ts:13`, `https://assets.mixkit.co/...mp3`) is a plain asset GET with no user data, so it is not a disclosure issue — but bundle the sound file locally anyway (`assets/sounds/new-order.mp3` does not currently exist, which is why the fallback is reached).

#### Note B — the profile picture is *not* collected

`app/edit-profile.tsx:43-86` lets the courier pick or shoot a photo and stores the URI in `useState` (`setProfileImage`). But the save call at `:131` is:

```ts
await courierApi.updateProfile({ firstName, lastName, email, phone });
```

No image is transmitted. So the profile picture stays on-device and is **not** collected. Only `app/report-issue.tsx` photos are. If someone wires the avatar upload later, nothing about the Data safety answer changes (Photos is already Yes) — but the purpose list would gain "Account management".

### 4.3 Data deletion sub-section

Console asks, under the "Data deletion" question:

| Field | Answer |
|---|---|
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Users can request account deletion | **Yes** |
| Users can request that some or all data is deleted without deleting their account | **No** (unless you build partial deletion — you have not) |
| URL where users can request account and data deletion | `[ACTION REQUIRED: https://your-domain.com/delete-account]` — see §6.3 for the page to publish |

---

## 5. Background location declaration and demo video

### 5.1 What triggers this

The `expo-location` plugin block in `app.config.ts` turns background location on:

```ts
['expo-location', {
  isAndroidForegroundServiceEnabled: true,
  isAndroidBackgroundLocationEnabled: true,
  isIosBackgroundLocationEnabled: true,
  …
}]
```

which is what injects `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_LOCATION` into the resolved permission list quoted in §1.7.

`ACCESS_BACKGROUND_LOCATION` in the merged manifest routes your submission to **Play Console → App content → Sensitive app permissions → Location permissions**, a *manual human review* with a written justification and a **mandatory video**. Budget days, not hours, for each round-trip. `FOREGROUND_SERVICE_LOCATION` separately triggers the **Foreground service permissions** declaration (§7.2) — that is a *different* form; do not conflate them.

> `[BLOCKER]` **The code does not currently implement background location.** Verified: the only location acquisition is foreground.
>
> ```
> $ grep -rn "startLocationTracking\|requestBackground\|TaskManager" --include="*.ts" --include="*.tsx" app components context
> components/OrderMap.tsx:59:    const startLocationTracking = async () => {
> components/OrderMap.tsx:102:    startLocationTracking();
> context/CourierContext.tsx:1346:  const startLocationTracking = useCallback(async () => {
> context/CourierContext.tsx:1393:  const toggleOnline = async () => {
> context/CourierContext.tsx:1398:      await startLocationTracking();
> ```
>
> and `context/CourierContext.tsx:1347` requests foreground only:
> ```ts
> const { status } = await Location.requestForegroundPermissionsAsync();
> ```
> There is no `Location.requestBackgroundPermissionsAsync()`, no `Location.startLocationUpdatesAsync()`, and `expo-task-manager` is not in `package.json`.
>
> **Declaring a permission the app does not use is itself a policy violation, and the declaration cannot be approved** — the reviewer will look for the behaviour in your video and not find it. You have two paths:
> 1. **Implement background location** (background permission request + a TaskManager task PUTting fixes) — then everything below applies as written.
> 2. **Ship v1 without it**: set `isAndroidBackgroundLocationEnabled: false` and `isAndroidForegroundServiceEnabled: false` in the `expo-location` plugin block of `app.config.ts` (that alone drops all three permissions from the resolved list — confirm with `npx expo config --type prebuild --json`), and skip §5 and §7.2 entirely. Foreground-only tracking still works for a courier who keeps the app open, and you can add background location in v1.1 once the store presence exists. **This is the fastest route to a first production release and deserves serious consideration** — it converts your riskiest, slowest review item into a later, lower-stakes one.
>
> `[RE-VERIFY]` Another agent may be implementing this. Re-run the grep above and check `grep -n expo-task-manager package.json` before deciding.

The rest of §5 is written assuming path 1.

### 5.2 The permission-justification text

Console gives you a free-text box (roughly 500 characters in the current form — check the live limit and trim to fit). Paste this:

> ZBR Courier is a workforce app used only by delivery couriers under contract to our dispatch service. Background location is core, not optional: while a courier is on an active delivery they navigate inside Google Maps, so our app is not in the foreground, yet dispatch and the waiting customer need the courier's live position to show accurate tracking and ETA. It also lets us offer each new order to the nearest available courier. Tracking runs only while the courier has explicitly toggled themselves online, and stops the moment they go offline.

If you are given more room, the fuller version:

> **Feature requiring background location:** live delivery tracking and proximity-based order dispatch.
>
> **Why foreground-only access is insufficient:** the courier's core task is driving. From the moment they accept an order they are in a turn-by-turn navigation app — `app/order/[id].tsx:176` and `app/map-navigation/[orderId].tsx:147` deliberately hand off to Google Maps, because riding a motorcycle through Tashkent traffic requires a real navigation app, not our map view. ZBR Courier is therefore backgrounded for most of every delivery. During exactly that window, three things depend on the courier's position: (1) the customer's live tracking map, (2) dispatch's ability to detect a stalled or off-route delivery, and (3) matching the next order to the nearest courier so food arrives hot. A foreground-only implementation would report the courier's location only while they are staring at our app, which is precisely when they are not delivering.
>
> **User control:** location collection begins only when the courier flips the "Online" switch on the Orders screen and ends when they flip it off or log out. A courier who is off-shift is not tracked. Before the first Android permission dialog we show an in-app disclosure screen explaining what we collect, why, and that collection continues in the background; the courier must acknowledge it before the system dialog appears.
>
> **Audience:** this app is distributed to our own contracted couriers. It is not a consumer app and has no consumer-facing tracking features.

### 5.3 Prominent disclosure — status and requirement

Play's requirement, precisely: **an in-app disclosure that appears *before* the runtime permission dialog**, that (a) is not buried in a privacy policy or terms-of-service, (b) names the data as location, (c) states that collection continues **in the background / when the app is not in use**, and (d) requires an affirmative user action to proceed.

> `[BLOCKER]` `[RE-VERIFY]` **`components/LocationDisclosureModal.tsx` does not exist in this tree at the time of writing:**
> ```
> $ ls components/ | grep -i "disclosure\|location"
> (no output)
> $ grep -rn "LocationDisclosure" --include="*.tsx" --include="*.ts" app components context
> (no output)
> $ grep -n "location" i18n/locales/en.json
> 187:    "your_location": "Your Location",
> 500:    "location_permission_required": "Location permission is required to find nearby orders."
> ```
> No disclosure component, no disclosure strings in any of the three locales. And the current permission request at `context/CourierContext.tsx:1347` fires `Location.requestForegroundPermissionsAsync()` **immediately** on toggling online, with nothing shown first.
>
> Another agent is expected to add this component. **Before you record the video or fill the declaration, re-run the two greps above and read the actual copy.** If the component now exists, verify all four conditions hold and that it is rendered *before* the permission call in `toggleOnline` (`context/CourierContext.tsx:1393-1401`). If it still does not exist, the declaration cannot be approved — no amount of good justification text substitutes for the on-screen disclosure the reviewer must see in your video.

Copy that satisfies the requirement, if you need to write or check it (all three locales — `i18n/locales/en.json`, `ru.json`, `uz.json`):

> **Title:** ZBR Courier needs your location
>
> **Body:** To send you delivery offers near you and to show the customer where their order is, ZBR Courier collects your location — **including while the app is closed or not in use** — from the moment you go online until you go offline.
>
> We use it to: offer you the closest deliveries · show your live position to dispatch and the customer during an active delivery · calculate your route.
>
> We stop collecting your location as soon as you go offline or log out. We never collect it while you are off shift.
>
> **Buttons:** `Continue` (proceeds to the Android permission dialog) · `Not now` (dismisses; the courier stays offline)

The phrase *"including while the app is closed or not in use"* is the specific wording reviewers look for. Do not soften it to "in the background" alone.

### 5.4 Demo video — shot-by-shot script

**Requirements Console states:** a link to a video showing the in-app feature that uses background location, and showing the prominent disclosure. It must be viewable without login. Silent screen recordings with no context are the most common cause of a rejected declaration.

**Format:** portrait screen recording of a **real Android device** (not an emulator, not a slideshow), 90–150 seconds, with either burnt-in captions or clear voice-over. Record with the device's built-in screen recorder or `adb shell screenrecord`.

| # | Shot | What is on screen | Caption / narration |
|---|---|---|---|
| 1 | 0:00–0:08 | Static title card, or the app icon on the home screen | *"ZBR Courier — background location demonstration. ZBR Courier is a workforce app for contracted delivery couriers."* |
| 2 | 0:08–0:18 | Fresh install. Open app → onboarding → login screen. Type the demo email/password and log in. Land on the Orders screen. | *"A courier logs in. This account is a pre-approved courier, so it opens directly to the order screen."* |
| 3 | 0:18–0:30 | Orders screen, offline. **Slowly** tap the Online toggle top-right. | *"Location tracking starts only when the courier chooses to go online. Nothing is collected before this moment."* |
| 4 | 0:30–0:50 | **The disclosure screen appears. Hold it on screen, unmoving, for at least 8 seconds so every line is readable.** Optionally slow-zoom on the sentence containing "including while the app is closed or not in use". | *"Before Android asks for anything, our own disclosure explains what we collect, why, and that collection continues while the app is closed or not in use. The courier must tap Continue."* — **This is the shot the reviewer is looking for. Do not rush it.** |
| 5 | 0:50–0:58 | Tap **Continue**. The Android system dialog appears. Grant **"While using the app"**. | *"Only after the courier accepts our disclosure does the Android permission dialog appear."* |
| 6 | 0:58–1:10 | The app's background-permission request appears; grant **"Allow all the time"** (on Android 11+ this opens Settings — record that too, tap "Allow all the time", return to the app). | *"The courier then grants background access, which Android requires as a separate, deliberate step."* |
| 7 | 1:10–1:25 | Available tab now lists seeded offers. Tap one, show pickup and drop-off on the map, tap **Accept**. | *"Order offers are matched to the courier's current position. The courier accepts a delivery."* |
| 8 | 1:25–1:45 | Open the active order, tap **Navigate**. **Google Maps opens and fills the screen.** Hold there for 8–10 seconds. Then show the persistent ZBR Courier notification in the status bar / notification shade. | *"This is why background location is necessary. The courier is now driving inside Google Maps — our app is in the background. During this window dispatch and the customer still need the courier's live position. The ongoing notification shows the courier that tracking is active."* |
| 9 | 1:45–1:55 | Return to ZBR Courier. Advance the order: Picked up → In transit → Delivered. | *"The delivery completes."* |
| 10 | 1:55–2:05 | Toggle **Offline**. Show that the tracking notification disappears. | *"When the courier goes offline, location collection stops immediately. Off-shift couriers are never tracked."* |

**What ruins the video, in order of frequency:**
- Disclosure shown *after* the system dialog, or not at all.
- Disclosure on screen for under 3 seconds.
- Never showing the app actually backgrounded — the reviewer must *see* another app on top while your tracking continues (shot 8 is doing that work).
- Emulator recording — the Android permission dialogs look subtly wrong and reviewers notice.
- A blank grey map because of the missing Maps API key (§1.5). Fix that before recording.

### 5.5 Hosting the video

Console asks for a **URL**, not an upload. Standard and accepted:

- **YouTube, visibility "Unlisted."** Not Private (Google's reviewer is not on your allow-list and cannot open a Private video — this is a real and common failure). Not Public unless you want couriers finding it. Disable comments if you like; that does not affect access.
- Alternative: Google Drive with "Anyone with the link — Viewer", or a plain `https://` link to an MP4 on your own domain. Whatever you choose, **open the URL in a private/incognito window with no Google account signed in and confirm it plays.** A dead video link is an automatic rejection round-trip.

`[ACTION REQUIRED: record the video, upload as Unlisted, verify in incognito, paste the URL into the Location permissions declaration]`

---

## 6. Account deletion requirements

Play requires **both** mechanisms. One without the other fails.

### 6.1 In-app deletion — currently a stub that lies

The in-app path is in **`app/security.tsx`**, not `app/(tabs)/settings.tsx`. Settings links to it: `app/(tabs)/settings.tsx:166-170` renders a `Security` menu item that does `router.push('/security')`. The help centre agrees — `i18n/locales/en.json` FAQ answer: *"Go to Settings > Security > Delete Account."*

But `app/security.tsx:138-156`:

```ts
const handleDeleteAccount = () => {
  Alert.alert(
    t('security.delete_account_title'),
    t('security.delete_account_message'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.delete'),
        style: 'destructive',
        onPress: () => {
          // In production, initiate account deletion
          Alert.alert(
            t('security.delete_requested'),
            t('security.delete_requested_message')
          );
        },
      },
    ]
  );
};
```

The confirm button calls **no API**. It shows *"Your account deletion request has been submitted. You will receive an email confirmation shortly."* (`i18n/locales/en.json:332`) and does nothing. And `constants/config.ts` has no delete endpoint — the `USER` block contains only `LOGOUT_ALL: '/api/v1/users/me/logout-all'`.

> `[BLOCKER]` This is worse than a missing feature. Telling a user their data has been deleted when it has not is a **Deceptive Behavior** violation on top of the User Data / account-deletion violation. Ship it wired or remove the button — do not ship the stub.
>
> `[RE-VERIFY]` Another agent is expected to wire this to `DELETE /api/v1/users/me`. Before submitting, confirm:
> ```bash
> grep -n "DELETE_ACCOUNT\|users/me'" constants/config.ts
> grep -n "deleteAccount\|method: 'DELETE'" app/security.tsx context/CourierContext.tsx services/api.ts
> ```
> You need to see a real `DELETE` request and a logout+redirect on success. Then test it end-to-end: delete a throwaway account, confirm the credentials no longer log in.

What "wired" must mean for policy purposes: the in-app flow deletes the **account** and the associated data, is reachable without contacting support, and is discoverable — Settings → Security → Delete Account is acceptable discoverability.

### 6.2 Web deletion URL — required, and nothing hosts it

Play requires a URL, reachable **without installing the app and without logging in**, where a user can request deletion of their account and data. Nothing in this repository serves web content; this must be hosted on your own domain.

> `[ACTION REQUIRED: publish a deletion request page and paste its URL into Play Console → App content → Data safety → Data deletion, and into your privacy policy]`
>
> Suggested URL: `https://<your-domain>/delete-account`

### 6.3 Draft content for the web deletion page

Publish this as static HTML. Replace every bracketed placeholder. Keep it in English at minimum; Russian and Uzbek versions are worth adding since your couriers use all three (`i18n/locales/`).

---

**Delete your ZBR Courier account**

ZBR Courier is the app our delivery couriers use to receive and complete deliveries. This page explains how to delete your ZBR Courier account and the data connected to it. You do not need the app installed to use this page.

**Option 1 — delete from inside the app (fastest)**

1. Open ZBR Courier and log in.
2. Go to **Settings → Security**.
3. Tap **Delete Account** and confirm.

Your account is closed immediately and the data listed below is deleted on the schedule shown.

**Option 2 — request deletion by email**

If you can no longer sign in, email **[ACTION REQUIRED: privacy@your-domain.com]** from the email address on your courier account, with the subject **"Delete my ZBR Courier account"**. Include the phone number registered to the account so we can identify it. We will verify that the request comes from the account holder before acting on it, and we will confirm by email when deletion is complete.

We respond within **[ACTION REQUIRED: e.g. 3]** working days and complete deletion within **30 days** of verifying your request.

**What is deleted**

- Your name, email address, and phone number
- Your courier profile: vehicle type, vehicle registration plate, driving licence number, preferred delivery radius
- Your stored location history
- Your device push-notification tokens
- Your delivery history and ratings, and any photos or descriptions you submitted when reporting a delivery issue

**What is kept, and why**

- **Financial and tax records of completed deliveries**, in a form no longer linked to your name, retained for **[ACTION REQUIRED: state the period your accountant requires — e.g. 5 years]** because **[ACTION REQUIRED: cite the accounting/tax obligation]**.
- **Anonymised, aggregated delivery statistics** that cannot identify you.

If you want to know exactly what is held about you before deciding, email the address above and ask for a copy.

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

The merged manifest is authoritative — regenerate it (§1.6) and dump it (§1.7) before filling anything in. This table covers every permission a correct build will contain.

### 7.1 Dangerous and normal permissions

| Permission | Source | Does this app use it? | Justification (for Console / your own records) |
|---|---|---|---|
| `INTERNET` | template | Yes | All API, WebSocket, and push traffic. Normal permission, no declaration. |
| `ACCESS_FINE_LOCATION` | config + expo-location | **Yes** | `context/CourierContext.tsx:1374` requests `Location.Accuracy.High`. Needed to match a courier to the nearest order and to place them accurately on the customer's tracking map — street-level accuracy is the point. |
| `ACCESS_COARSE_LOCATION` | config + expo-location | Yes | Paired with FINE per Android convention; supports couriers who grant approximate-only. |
| `ACCESS_BACKGROUND_LOCATION` | expo-location plugin (`isAndroidBackgroundLocationEnabled: true`) | **Declared; not yet used** — see §5.1 `[BLOCKER]` | If implemented: live tracking while the courier is inside a navigation app mid-delivery. **Triggers the Location permissions declaration + demo video (§5).** If not implemented, set `isAndroidBackgroundLocationEnabled: false`. |
| `FOREGROUND_SERVICE` | expo-location plugin (`isAndroidForegroundServiceEnabled: true`) | Only if background tracking is implemented | Runs the location foreground service so the courier can see tracking is active. |
| `FOREGROUND_SERVICE_LOCATION` | expo-location plugin | Only if background tracking is implemented | Android 14+ requires the typed FGS permission. **Triggers a separate Foreground service permissions declaration — see §7.2.** |
| `POST_NOTIFICATIONS` | config **and** expo-notifications library | **Yes** | New order offers arrive by push (`app/_layout.tsx` handles `NEW_DELIVERY_AVAILABLE`). Runtime permission on Android 13+; requested in `services/pushNotification.ts:51-54`. No Console declaration required. |
| `RECEIVE_BOOT_COMPLETED` | expo-notifications library manifest | Yes (library) | Re-registers scheduled notifications after reboot. Normal permission, merged at build time — it will not appear in `android/app/src/main/AndroidManifest.xml`, only in the built bundle. |
| `VIBRATE` | config + template | Yes | `app/_layout.tsx:121` sets `vibrationPattern` on both notification channels; `expo-haptics` is used in the UI. Normal permission. |
| `CAMERA` | expo-image-picker library manifest | **Yes** | `app/report-issue.tsx:85-99` — courier photographs a delivery problem (damaged package, wrong address). `app/edit-profile.tsx:76-86` — profile picture (on-device only, see §4 Note B). Runtime permission, no Console declaration. |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | expo-image-picker + template | Legacy only — requested on API < 33 (and WRITE on API < 29 for the camera path); minSdk here is 24 | Picking an existing photo. **There is no `READ_MEDIA_IMAGES`** — expo-image-picker uses the Android Photo Picker instead, so **no Photo and Video Permissions declaration is needed.** Re-verify with the `aapt2 dump permissions` command in §1.7. |
| `MODIFY_AUDIO_SETTINGS` | expo-audio | Yes | Sets the audio mode so the new-order alert plays over silent/DND (`services/soundService.ts`). Normal, non-dangerous, invisible to the user. No declaration. |
| ~~`RECORD_AUDIO`~~ | expo-audio (blocked) | **No** | Stripped via `blockedPermissions`. See §1.8 — this one mattered. |
| ~~`FOREGROUND_SERVICE_MEDIA_PLAYBACK`~~ | expo-audio (blocked) | **No** | Stripped. Would have forced a second FGS declaration for a lock-screen media session this app never starts. |
| ~~`SCHEDULE_EXACT_ALARM`~~ | old `app.json` (blocked) | **No** | Stripped. Play restricts exact alarms to alarm-clock and calendar apps; nothing here schedules one. |
| ~~`SYSTEM_ALERT_WINDOW`~~ | bare template (blocked) | **No** | Stripped. Draw-over-other-apps, unused, and it would surface "Display over other apps" on your listing. |

**Guiding rule:** every permission in the merged manifest must map to a feature a reviewer can *see working in your build*. Declared-but-unused permissions are the cheapest rejection to avoid and the most common to overlook. The four struck-through rows are the ones this project nearly shipped by accident — all four arrived from dependencies, none from anyone's intent. **Re-run the `aapt2 dump permissions` check on every release**, because a single dependency bump can reintroduce any of them.

### 7.2 Foreground service permissions declaration (separate form, easy to miss)

If `FOREGROUND_SERVICE_LOCATION` survives into the merged manifest, Play Console → **App content → Foreground service permissions** requires a per-type declaration: the use case, why a foreground service is required, and (Console currently asks for) a video showing the feature.

Text to paste for the `location` type:

> **Foreground service type:** location
> **Feature it supports:** live delivery tracking while a courier is on an active delivery.
> **Why a foreground service is required:** the courier's phone is in a mount or a pocket while they drive, and they are usually inside a navigation app rather than ours. A foreground service is the only way Android permits continuous location updates for the duration of a delivery, and its ongoing notification is what tells the courier tracking is active, with a one-tap route back into the app.
> **User-facing notification:** a persistent notification appears for as long as the courier is online, and disappears the moment they go offline.

You can reuse the §5.4 video for this declaration — shot 8, showing the persistent notification while Google Maps is on top, is exactly what this form is asking to see.

---

## 8. Content rating questionnaire

Play Console → **App content → Content rating**. The questionnaire is issued by IARC; wording varies by rating body but the substance below is stable.

| Question | Answer | Reasoning |
|---|---|---|
| Category of app | **Utility, Productivity, Communication, or Other** | ZBR Courier is a work tool. Do **not** pick a game category. |
| Violence — realistic, cartoon, or otherwise | **No** | Nothing in the app. |
| Sexuality / nudity | **No** | — |
| Language — profanity | **No** | No user-to-user free text is published anywhere. |
| Controlled substances — drugs, alcohol, tobacco references | **No** | Deliveries are described generically as orders; the app renders no product catalogue. If your dispatch service ever carries alcohol, revisit this. |
| Gambling — simulated or real | **No** | — |
| Crude humour / horror / fear | **No** | — |
| **Does the app allow users to interact or exchange content with other users?** | **No** — *with the reasoning below* | See §8.1. |
| Does the app share the user's current physical location with other users? | **Yes** | See §8.2. |
| Does the app allow users to purchase digital goods? | **No** | No IAP, no billing library, no payment SDK (§1.3). |
| Does the app contain user-generated content that is publicly visible? | **No** | Nothing the courier submits is published to any audience. |
| Does the app collect or share personal information with third parties? | **Yes** | Location, name, email, phone, device tokens go to your backend; precise location currently also reaches `router.project-osrm.org` (§4 Note A). |
| Digital purchases / real-money loot boxes | **No** | — |

**Expected outcome:** the lowest rating the questionnaire can issue for a utility app that shares location — typically **ESRB Everyone / PEGI 3 / USK 0 / IARC 3+**, with a "Users Interact" and/or "Shares Location" interactive-elements notice attached because of the location answer. That notice is normal and harmless; it is not a content warning.

### 8.1 The user-generated-content question — think about this one

Two features look like UGC and are not, plus one that genuinely is:

- **The order rating comment box.** `app/order-rating/[orderId].tsx:37` holds a `comment` state and renders a text field — but the submit handler at `:84` is:
  ```ts
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));
  // In production, submit rating to API
  // await api.submitRating({ orderId, overallRating, selectedTags, comment });
  ```
  The comment is **never transmitted anywhere**, and even if it were, it would go to your dispatch back office, not to other users. Not UGC.
- **Chat.** `app/chat.tsx:84-108` — messages append to local state and a canned reply arrives via `setTimeout`. No network call at all. Not UGC. **Wire chat to a real backend and both answers change**: it becomes user-to-user interaction and you would answer "Yes" to the interaction question.
- **Issue reports** (`app/report-issue.tsx:120-124`) — free text plus photos *do* reach your backend. But they go to your support staff on a one-to-one basis and are never shown to another app user. Under IARC's framing this is a support channel, not user interaction. Answer **No**, and if a reviewer queries it, explain it exactly that way.

So: **answer No today.** Set a reminder that the answer flips if chat is ever wired up — content rating is one of the things that requires a fresh questionnaire when app behaviour changes (§11).

### 8.2 The location-sharing question — answer Yes

The courier's location is transmitted (`context/CourierContext.tsx:1320-1341`) and, per your own product description, is surfaced to dispatch operators and to the customer tracking the delivery. Those are other people. **Answer Yes.** It costs you nothing on the resulting rating and answering No would be a misrepresentation that surfaces the moment a reviewer reads your background-location justification, which says the opposite.

---

## 9. Target audience and content

Play Console → **App content → Target audience and content**.

### 9.1 Target age

| Field | Answer |
|---|---|
| Target age groups | **18 and over only.** Deselect every other band. |
| Is your app designed for children? | **No** |
| Does your store listing appeal to children? | **No** |

Reasoning to keep on file: couriers must hold a driving licence — `app/become-courier.tsx:50-54` makes `licenseNumber` a required field with a minimum length — and must be approved by your operations team before working. Selecting any under-18 band would drag you into the **Families policy**, which is incompatible with background location collection.

### 9.2 Ads

| Field | Answer |
|---|---|
| Does your app contain ads? | **No** |

Verified: no ad SDK of any kind in `package.json` (§1.3), no `AD_ID` permission, no WebView ad surface. Because you answer No, do **not** declare the `com.google.android.gms.permission.AD_ID` permission — check with the `aapt2 dump permissions` command in §1.7 that nothing pulled it in transitively.

### 9.3 Financial features — the one that needs actual thought

Play Console asks: *"Does your app provide financial features?"* — sub-types include payments/money transfer, lending, insurance, investing, crypto, and financial-management tools.

**Answer: No.**

The reasoning, because this is genuinely arguable and you should be able to defend it:

- The app **displays** money. `app/(tabs)/finance.tsx` renders today/week/month earnings and a `pendingPayout` figure from `GET /api/v1/couriers/me/earnings`. Display of your own employment earnings is not a financial feature — otherwise every payslip app would be one.
- The app **shows a payment method badge**. `app/order/[id].tsx:245-250` renders `order.isPaid ? "Paid" : (order.paymentMethod ?? 'CASH')`. That is a read-only label telling the courier whether to expect cash at the door.
- **Couriers do collect cash from customers.** This is the part that tempts a "Yes". But the cash changes hands *in the physical world*, between customer and courier. The app does not initiate, process, route, hold, or settle that money. There is no payment SDK, no card entry field, no bank details, no wallet, no `BILLING` permission, no money-transfer API call anywhere in the codebase. Grep confirms: no payment provider appears in `package.json`, and `constants/config.ts` `API_ENDPOINTS` contains no payment endpoint.
- Play's financial-features declaration exists to catch apps that *are* the financial instrument — apps that move money, lend it, or give investment advice. A logistics app that reports "this order is cash on delivery" is not one, any more than a restaurant POS training app is a bank.

**Answer No, and write this note in your internal submission record:** *"Couriers collect cash on delivery in person. The app processes no payments, holds no funds, and integrates no payment provider; it only displays whether an order is prepaid and reports earnings owed by us to the courier."* If a reviewer ever queries it, that paragraph is your answer.

**When this answer flips to Yes:** if you add in-app courier payouts, a wallet balance the courier can draw down, card-based cash reconciliation, or any integration with a payment provider. Note that `i18n/locales/en.json` already contains a FAQ string promising *"Go to the Earnings tab and tap 'Withdraw Funds'"* — a feature that **does not exist in the code**. See §10 for why that string is a problem in its own right.

### 9.4 Other App content declarations

| Declaration | Answer | Basis |
|---|---|---|
| News app | **No** | No editorial content. |
| COVID-19 contact tracing or status app | **No** | No health functionality of any kind. |
| Government app | **No** | Private commercial delivery service. |
| Health apps | **No** | — |
| Data safety | See §4 | — |
| Privacy policy URL | `[ACTION REQUIRED: https://your-domain.com/privacy]` | Mandatory for all apps. See §10.2. |

---

## 10. Store listing policy constraints

### 10.1 What the description may not claim

Delivery and driver apps get elevated scrutiny because the category attracts fake gig-work listings and recruitment scams. Assume a human reads your listing carefully.

**Do not write, because the code does not support it:**

- Anything about **in-app chat with customers** — `app/chat.tsx` is a local simulation (`:98`).
- Anything about **rating customers or being rated** as a live feature — `app/order-rating/[orderId].tsx:85` never submits.
- **"Withdraw your earnings instantly"** or similar. There is no withdrawal feature. `i18n/locales/en.json` already contains a help-centre answer promising a "Withdraw Funds" button in the Earnings tab; `app/(tabs)/finance.tsx` has no such button. `[ACTION REQUIRED: either build withdrawal or fix that FAQ string in all three locales before submitting]` — a reviewer who follows your own in-app instructions to a button that does not exist has found a deceptive-behaviour issue.
- **Guaranteed earnings figures** ("Earn 5,000,000 UZS a month!"). Play scrutinises income claims in gig-work listings hard. Describe the app, not hypothetical income.
- **Turn-by-turn navigation** as a feature of this app. `app/order/[id].tsx:176` and `app/map-navigation/[orderId].tsx:147` hand off to Google Maps via `Linking.openURL`. Say "one-tap handoff to your navigation app", which is true and is also exactly the behaviour your background-location justification depends on.

**Do write, because it is all verifiably true:**

- Receive delivery offers near you, with push notification alerts.
- See pickup and drop-off on a map with the route.
- Advance a delivery through picked up → in transit → delivered.
- Report a problem with a delivery, with photos.
- Track your earnings by day, week, and month.
- Available in English, Russian, and Uzbek (`i18n/locales/`).

**Keyword spam rules.** No repeated keyword strings, no competitor names, no "#1 courier app", no "Google" or "Play" in the title, no emoji or ALL-CAPS shouting in the title, no fake urgency. Title ≤ 30 chars, short description ≤ 80, full description ≤ 4000 — and the full description must read as prose to a human, not as a keyword list. Play's Store Listing and Promotion policy rejects listings whose description is a comma-separated keyword dump.

**The "this is a workforce app" framing helps you.** State plainly in the first line of the description that ZBR Courier is for couriers already working with ZBR. It sets the reviewer's expectation that the app is login-gated (making §3 coherent rather than suspicious), and it heads off the "this looks like a job scam" reflex.

### 10.2 Privacy policy

Required, and the URL must be live before you submit — Play fetches it.

> `[BLOCKER]` `app/onboarding.tsx:77-80`:
> ```ts
> const handlePrivacyPolicy = () => {
>   // Placeholder for privacy policy link
>   Linking.openURL('https://google.com');
> };
> ```
> The in-app Privacy Policy link opens Google's homepage. A reviewer will tap it. `[ACTION REQUIRED: publish a real privacy policy and replace this URL — ideally via a constant in constants/config.ts so the settings screen and help centre can reuse it]`

The policy must, at minimum, match §4 exactly: name every data type collected, state that **precise location is collected in the background while the courier is online**, name any third party that receives data (including `router.project-osrm.org` if you keep §4 Note A's Option 2), state retention periods, and link the deletion route from §6.3. A privacy policy that contradicts the Data safety form is itself a violation — the two are cross-checked.

### 10.3 Store listing assets

| Asset | Requirement | Note for this app |
|---|---|---|
| App name | ≤ 30 chars | "ZBR Courier" — matches `app.config.ts` `name`. Keep them identical. |
| Short description | ≤ 80 chars | e.g. *"Delivery app for ZBR couriers: get orders, navigate, track your earnings."* |
| Full description | ≤ 4000 chars | See §10.1. |
| App icon | 512×512 PNG, 32-bit | `app.config.ts` now points `icon` at `./assets/images/icon.png` and `adaptiveIcon.foregroundImage` at `./assets/images/adaptive-icon.png` (the old `app.json` pointed both at an **SVG**, which Expo's image pipeline handles poorly). The Console listing icon is a **separate upload** from the in-app launcher icon. `[ACTION REQUIRED: export a 512×512 32-bit PNG for the Console listing]` |
| Feature graphic | 1024×500 PNG/JPG | Required. No text smaller than roughly 24pt; it is displayed small. |
| Phone screenshots | 2–8, min 320px shortest side | **Do not include screenshots showing a blank grey map (§1.5) or an empty Available list.** Capture from the seeded demo account. Blur or use fake customer names and phone numbers — real customer PII in a public store listing is its own problem. |

---

## 11. Release tracks strategy

### 11.1 Recommended path

**Internal testing → Closed testing → Production.** Do not upload straight to Production.

The whole argument in one line: **the background-location declaration is a manual human review that takes days, and it is attached to your app, not to a specific track — so you want to discover a rejection while it costs you nothing.**

| Track | What you do | Why it matters here |
|---|---|---|
| **1. Internal testing** (up to 100 testers, available in minutes) | Upload the first AAB. Fill in **all** of App content: Data safety, Location permissions declaration + video, Foreground service declaration, App access, Content rating, Target audience, Privacy policy. Install on 2–3 real Android devices covering Android 12, 13/14, and 15/16. | This is where the location declaration review actually starts. Internal testing publishes near-instantly, so you get the app onto devices while the human review runs in parallel. It is also where you catch the things a reviewer would catch and you cannot: the blank map, the `localhost` base URL baked into the bundle, the disclosure firing after the permission dialog, the deletion stub. **The pre-launch report** on this track runs your app on Google's real device farm and returns crash traces, accessibility issues, and — importantly for you — the 16 KB page-size warning. |
| **2. Closed testing** (a named tester list or email list) | Put 5–20 real couriers on it for a week of genuine shift use. | Background location bugs are almost impossible to catch on a desk: doze mode, battery optimisation killing the foreground service, the OEM-specific "aggressive battery saver" behaviour on the phones your couriers actually own. A week of real shifts surfaces these. This is also your last chance to find that the demo account and seeded orders have quietly expired. |
| **3. Production** | Roll out **staged**: start at 10–20%. | Staged rollout lets you halt without pulling the release if the location service misbehaves at scale. Once a release is at 100% you cannot un-ship it — you can only ship a fix, which needs a fresh review cycle. |

**Sequencing tip:** get the location declaration **approved** while you are still in internal/closed testing. Console shows the declaration's status under App content. Do not schedule the production launch until it reads approved — otherwise your production release sits in review at exactly the moment you have told your couriers the app is live.

### 11.2 What requires a NEW review

Some changes go out silently; some restart a human review. Knowing which is which stops you from breaking your own launch.

| Change | Consequence |
|---|---|
| New AAB with the same permissions and no new data collection | Normal review (hours to ~2 days). No new declaration. |
| **Any change to what the app collects, or who receives it** — e.g. wiring chat to a real backend, adding crash reporting, uploading the profile photo, adding a payment provider | **Data safety form must be updated before the release goes live.** A mismatch between the form and app behaviour is a policy violation, and Google does audit it. |
| Adding, removing, or changing the use case of a **sensitive permission** — background location, a new foreground service type, exact alarms, media permissions | **New declaration and, for location and FGS, a new demo video.** Days. Plan around it. |
| **Changing the prominent disclosure copy or when it appears** | Re-record the video and resubmit the location declaration. Reviewers approved a specific flow. |
| Changing the app's category, target age, or answering the content-rating questionnaire differently | **New content rating.** Issued fast, but the app can show as unrated in the interim. |
| Changing the store listing text, screenshots, or icon | Listing review, typically hours. Independent of the binary. |
| **Changing `applicationId`** | Not possible. It is a new app, new listing, zero installs. See §1.6. |
| Bumping `versionCode` | Required for every upload. Play rejects a duplicate `versionCode` outright. It is declared explicitly at `app.config.ts` → `android.versionCode` (currently `1`); increment it there for every AAB, including re-uploads of the same `version`. Since `android/` is gitignored generated output, that file is the only place the number is tracked. |
| Losing the release keystore | Fatal without Play App Signing. **Enrol in Play App Signing when you create the app**, and keep your upload keystore backed up somewhere that is not the build machine. `[ACTION REQUIRED: generate the upload keystore, back it up off-machine, and record the passwords in your password manager]` |

---

## 12. What will get you rejected — bluntly, for this app

Ranked by how likely each is to actually happen to ZBR Courier.

**1. The reviewer cannot get in, or gets in and sees nothing.**
This is the modal failure for courier apps and this app has *three* gates: login, OTP, and admin verification. Even a perfect demo account fails if the backend's proximity filter hides all orders from a reviewer sitting outside Tashkent, or if the seeded orders expired. Test the exact flow yourself, from a clean install, on a device that has never run the app, from outside your office network, before you submit. If you do only one thing from this document, do that.

**2. The background-location declaration is rejected because the video does not show what it must.**
The reviewer needs to see, in this order: your disclosure → then the system dialog → then the app backgrounded while tracking continues. Miss any link in that chain and it comes back. And as of this writing the disclosure component **does not exist in the codebase** (§5.3) and no code requests background permission (§5.1) — so today the declaration is unapprovable no matter how good the video is. Fix the code, then film it.

**3. You ship a Delete Account button that does nothing.**
`app/security.tsx:138-156` currently tells the user their deletion request was submitted and calls no API. This is not a gap, it is a false statement to the user. It fails the account-deletion requirement *and* Deceptive Behavior. Wire it or remove it — and either way you still need the web URL (§6.2).

**4. The privacy policy link opens google.com.**
`app/onboarding.tsx:79`. It takes one tap to find. It reads to a reviewer as an app that was submitted without being finished, which colours everything else they look at.

**5. The map is a grey rectangle.**
No `com.google.android.geo.API_KEY` in the manifest (§1.5). Your app is a *map-centric delivery app*. A reviewer opening the order screen to a blank map fails you for broken functionality, and simultaneously disbelieves your background-location justification, because you claimed the map matters.

**6. Your Data safety form says location is not shared, while `lib/routing.ts:48` ships coordinates to `router.project-osrm.org`.**
Google cross-checks declarations against observed network behaviour. Getting caught understating data sharing is a serious enforcement category, not a paperwork nit. Remove the call or disclose it (§4 Note A).

**7. You build from the stale `android/` directory and ship permissions your config already blocks.**
`android/` is generated output — it is now gitignored precisely because a committed copy silently overrides the config and goes stale. The copy on disk predates `app.config.ts` and still declares `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM`, and `SYSTEM_ALERT_WINDOW` (§1.6). Shipping a microphone permission in a courier app is the kind of thing that gets a manual reviewer to read everything else twice. `npx expo prebuild --platform android --clean` immediately before every release build, then `aapt2 dump permissions` on the artifact.

**8. Push notifications simply do not work.**
`services/pushNotification.ts:63` asks Expo's push service for a token, with a `projectId` that is unset because EAS was removed. The call throws, the catch returns `null`, and no token is ever registered — so no courier ever receives an order offer. A reviewer who grants notification permission and then never sees the feature you described has found a broken app, not a policy issue, but it fails you just the same.

**9. Your app cannot reach its backend because `http://localhost:8080` got baked into the bundle.**
`EXPO_PUBLIC_*` values are inlined at bundle time (§1.4). Set the env var in the shell that runs Gradle, then grep the exported bundle to prove it took.

**10. Your store listing promises chat, ratings, or fund withdrawal.**
All three exist as UI with no backend (`app/chat.tsx:97`, `app/order-rating/[orderId].tsx:85`, and the "Withdraw Funds" FAQ string that points at a nonexistent button). Advertising unimplemented features is Deceptive Behavior — and the FAQ string is a problem even if your listing never mentions it, because it is your own app telling the user to tap something that is not there.

---

## 13. Pre-flight checklist

Print this. Tick every line before you press Publish.

**Code and build**
- [ ] `app.json` deleted or emptied, so `app.config.ts` is unambiguously the only config
- [ ] `google-services.json` present at repo root (`ls -l google-services.json`) **before** prebuild
- [ ] Google Maps API key added to `app.config.ts` → `android.config.googleMaps.apiKey`
- [ ] Push switched to `getDevicePushTokenAsync()`; a real FCM token confirmed arriving at `POST /api/v1/device-tokens`
- [ ] `rm -rf android && npx expo prebuild --platform android --clean` run fresh
- [ ] `grep applicationId android/app/build.gradle` → `app.zbr.courier`
- [ ] `grep -c ACCESS_BACKGROUND_LOCATION android/app/src/main/AndroidManifest.xml` → ≥ 1 (or 0, deliberately, per §5.1 path 2)
- [ ] `aapt2 dump permissions` on the built artifact shows **no** `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `READ_MEDIA_IMAGES`
- [ ] `EXPO_PUBLIC_RORK_API_BASE_URL` set to an `https://` URL, verified in the exported bundle
- [ ] `versionCode` incremented in `app.config.ts`; upload keystore backed up off-machine; Play App Signing enrolled
- [ ] Privacy policy URL replaces `https://google.com` in `app/onboarding.tsx:79`
- [ ] Delete Account calls a real `DELETE` endpoint and is tested end-to-end
- [ ] Location disclosure modal exists, renders **before** the permission dialog, and is translated into en/ru/uz
- [ ] Background location actually implemented (or `ACCESS_BACKGROUND_LOCATION` removed — §5.1)
- [ ] `lib/routing.ts` OSRM call removed, or disclosed as third-party sharing
- [ ] "Withdraw Funds" FAQ string fixed or the feature built, in all three locales
- [ ] `SUPPORT_EMAIL` / `SUPPORT_PHONE` in `constants/config.ts` are real and monitored

**Play Console — App content**
- [ ] App access: demo account added, tested on a clean install from outside your network
- [ ] Data safety: every row of §4 transcribed; encryption-in-transit answered honestly
- [ ] Data deletion URL live and reachable in an incognito window
- [ ] Location permissions declaration submitted, with the video URL verified in incognito
- [ ] Foreground service permissions declaration submitted (if FGS survives in the manifest)
- [ ] Content rating questionnaire completed
- [ ] Target audience: 18+ only
- [ ] Ads: No · News: No · COVID: No · Financial features: No
- [ ] Privacy policy URL entered

**Release**
- [ ] Internal testing release installed and exercised on Android 12, 14, and 16 devices
- [ ] Pre-launch report reviewed; no 16 KB page-size warning
- [ ] Closed test run for one week with real couriers on real shifts
- [ ] Location declaration shows **approved** in Console
- [ ] Production rollout started staged at 10–20%

# Production Launch Checklist — ZBR Courier

Concise guide to building and submitting the app for stores. App config lives in
`app.config.ts` (converted from `app.json` so build-time secrets can be injected
from the environment). Build profiles live in `eas.json`.

## 1. Environment variables

> **Build model:** builds are made LOCALLY (`npx expo prebuild` + Gradle /
> Xcode) and uploaded to the stores manually. EAS is NOT used — `eas.json`
> has been removed. All variables come from a `.env` file (Expo loads it
> automatically) or the shell running the build. Start from `.env.example`.

### Build-time secrets (read by `app.config.ts`, NOT `EXPO_PUBLIC_*`)

These are evaluated when the Expo config is resolved (prebuild/bundling).

| Variable | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Android Google Maps SDK key, injected into `android.config.googleMaps.apiKey` |
| `GOOGLE_SERVICES_JSON` | Optional path override for `google-services.json`; defaults to `./google-services.json` in the repo root. **REQUIRED for Android push** — when missing, config evaluation prints a warning and the build ships with Android push completely dead (and `getDevicePushTokenAsync` throws at runtime). Treat the warning as a release blocker. |

### Runtime client vars (`EXPO_PUBLIC_*`, inlined into the JS bundle)

Set them in `.env` (copy `.env.example`) before building — Expo inlines them at bundling time.

> **Guard:** `constants/config.ts` throws at app startup in production
> builds if ANY consumed `EXPO_PUBLIC_*` value still contains `REPLACE_ME`
> (case-insensitive) — a build made from an unedited template crashes
> immediately with the offending variable names instead of shipping with
> every network call silently pointed at a placeholder.

| Variable | Used in | Purpose |
|---|---|---|
| `EXPO_PUBLIC_RORK_API_BASE_URL` | `constants/config.ts` | Spring backend base URL (serves `/api/v1`) |
| `EXPO_PUBLIC_WS_URL` | `constants/config.ts` | WebSocket endpoint for live order/tracking updates |
| `EXPO_PUBLIC_WS_SOCKJS_URL` | `constants/config.ts` | Optional SockJS fallback endpoint (add to `eas.json` env if used) |
| `EXPO_PUBLIC_PROJECT_ID` | `services/pushNotification.ts` | Expo project ID used for `getExpoPushTokenAsync` (same UUID as `EAS_PROJECT_ID`) |
| `EXPO_PUBLIC_ROUTING_URL` | `lib/routing.ts` | Routing service (OSRM-compatible) base URL |
| `EXPO_PUBLIC_TERMS_URL` | `app/register.tsx`, `app/help-center.tsx` | Public Terms of Service URL |
| `EXPO_PUBLIC_PRIVACY_URL` | `app/register.tsx`, `app/onboarding.tsx`, `app/help-center.tsx` | Public Privacy Policy URL |
| `EXPO_PUBLIC_CRASH_ENDPOINT` | `lib/crashReporting.ts` | Optional. HTTPS endpoint receiving fire-and-forget crash POSTs (`{ message, stack, platform, appVersion }`). Not in `eas.json` by default — without it (and without Sentry, see the file header's upgrade path) production crash visibility is logcat/os_log only. |

All URL-valued vars share one TLS policy: production builds upgrade `http://`
to `https://` and `ws://` to `wss://` (`enforceSecureTransport` in
`constants/config.ts`, also applied in `lib/routing.ts` and
`lib/crashReporting.ts`).

## 2. Google Maps (Android only)

### Why a Google key is needed even though routing is OpenStreetMap

Three different jobs, three different providers — it is easy to assume OSM covers all of them:

| Job | Provider | Needs a Google key? |
|---|---|---|
| The **base map canvas** drawn in the app (tiles, labels, gestures) | `react-native-maps` with `PROVIDER_DEFAULT` (`components/OrderMap.native.tsx:242`) | **Android: yes.** react-native-maps only implements Google Maps on Android, so `PROVIDER_DEFAULT` resolves to the Google Maps SDK. **iOS: no** — it resolves to Apple MapKit, which is why no iOS maps key is configured. |
| The **route line** drawn on top of that canvas | OSRM — `lib/routing.ts:94`, `/route/v1/driving/...` | No. OSRM returns *geometry only* (a coordinate list rendered as a `<Polyline>`). It serves no tiles. |
| **Turn-by-turn navigation** | Handed off to an external app (Google Maps / Waze / Apple Maps) | No. It renders nothing inside our app. |

So OSRM and the external-app handoff cover routing and navigation, but nothing covers the
**in-app map imagery on Android**. Without the key that MapView renders as a grey rectangle —
markers and the route polyline may draw, but on an empty background — and logcat shows an
authorization failure. In a map-centric courier app a reviewer reads that as broken.

If you want to remove the Google dependency entirely, the real option is migrating
`OrderMap.native.tsx` to MapLibre (`@maplibre/maplibre-react-native`) with an OSM tile source.
That is a native dependency swap plus a tile provider decision (OSM's public tile server
forbids app-scale usage; MapTiler/Stadia have free tiers with attribution requirements) — a
deliberate post-launch project, not a release-week change.

### Steps

1. In Google Cloud Console, create/select a project and enable **Maps SDK for Android**.
   A billing-enabled project is required to mint a key at all. Check current Maps Platform
   pricing for your usage — native mobile map display has historically been the cheapest
   tier by far, but Google revised the pricing model in 2025, so verify rather than assume.
2. Create an API key and restrict it to **Android apps**: package `app.zbr.courier` plus the
   signing-certificate SHA-1 fingerprints (see the warning below).
3. Put it in `.env` at the repo root as `GOOGLE_MAPS_API_KEY=...`. It is consumed by
   `app.config.ts` at prebuild time and lands in the manifest as
   `com.google.android.geo.API_KEY`. `app.config.ts` prints a loud warning when it is missing.
4. iOS needs no key — Apple MapKit via the default provider.

> ### The SHA-1 trap that greys out maps in production
>
> **Play App Signing re-signs your app.** The certificate on the build that reaches users is
> Google's **app signing certificate**, not your upload certificate. If you restrict the Maps
> key to the SHA-1 of your *upload* keystore only, maps work in your local builds and are
> **grey for every real user**.
>
> Add both fingerprints to the key restriction:
> - **App signing certificate SHA-1** — Play Console → your app → **Test and release → Setup →
>   App integrity → App signing key certificate**. Available after your first upload.
> - **Upload certificate SHA-1** — so locally built debug/release APKs also render:
>   `keytool -list -v -keystore <your>.keystore -alias zbr-upload`
>
> Because the app signing SHA-1 only exists after the first upload, the practical order is:
> ship to the **internal testing** track first with an unrestricted (or package-only) key,
> then tighten the restriction once Play shows you the fingerprint — and re-test the map on
> an internal-track build before promoting.

## 3. Push notifications (FCM / APNs) — **RELEASE BLOCKER until done**

`app.config.ts` is already wired: it sets `android.googleServicesFile` to
`process.env.GOOGLE_SERVICES_JSON` (falling back to `./google-services.json`)
**only when that file actually exists**, so local dev without the secret still
works. The flip side: nothing fails the build when it's missing — the config
evaluation prints a `[app.config] ... Android push notifications will NOT
work` warning and the resulting Android binary has **zero push**. For a
courier app whose core loop is "get alerted to a new order with the phone in
your pocket", do not ship a build that printed that warning.

**Delivery model (decided):** the app registers NATIVE device tokens via
`getDevicePushTokenAsync` — the FCM registration token on Android and the raw
APNs device token on iOS, routed by the `deviceType` field. The backend sends
via Firebase Admin (Android) and directly via APNs (iOS) with its own platform
keys (already provisioned backend-side). The Expo push service is NOT used
anywhere, and `ExponentPushToken[...]` values must never reach the backend —
it rejects and deactivates them.

1. Create a Firebase project, add an Android app with package `app.zbr.courier`,
   and download `google-services.json` → put it at the **repo root** (it
   contains no private keys, only project identifiers — committing it is
   Google's documented default). `app.config.ts` wires it into the Android
   build automatically; prebuild copies it to `android/app/`.
2. iOS: enable the Push Notifications capability on the `app.zbr.courier`
   App ID in the Apple Developer portal. `app.config.ts` pins the
   `aps-environment: production` entitlement for store builds, and
   `ITSAppUsesNonExemptEncryption: false` skips the export-compliance prompt.
3. Verify on real devices after the first build: register (log in), have the
   backend send a test push to the registered token for BOTH platforms, with
   the app in foreground, background, and killed states.

## 4. ~~EAS project ID~~ (not applicable)

EAS is not used. No Expo project ID is required anywhere — push tokens are
native (`getDevicePushTokenAsync` needs no `projectId`).

## 5. Privacy Policy & Terms hosting

Both stores require a publicly reachable Privacy Policy URL (and App Store review
expects Terms for account-based apps). Host static pages on any HTTPS host
(e.g. company website, GitHub Pages, or the Spring backend as static resources)
and point `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` at them. The same
Privacy URL must be entered in App Store Connect and the Play Console listing.

## 6. Build & submit

Local builds, manual store uploads:

```sh
cp .env.example .env        # fill in real values first (once)
npm run prebuild            # bumps versionCode/buildNumber, regenerates android/

# Android — signed AAB for Play Console
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
# Configure release signing per RN docs (keystore in ~/.gradle/gradle.properties)

# iOS — archive in Xcode
open ios/ZBRCourier.xcworkspace
# Product → Archive → Distribute App → App Store Connect
```

**Version bumps are manual now:** increment `version`, `ios.buildNumber`, and
`android.versionCode` in `app.config.ts` before every store upload — the
stores reject re-used build numbers.

## 6a. OTA updates — explicit pre-launch decision required

**Current state: OTA is NOT available.** `expo-updates` is not installed and
EAS is not used. Consequence: **every JS fix ships as a full store build +
review cycle.** For a v1 launch to real couriers, that means a bad-payload
crash or locale bug stays live for however long store review takes.

Decide before launch, and record the decision here:

- **Option A — launch without OTA (current state).** Zero native-config risk.
  Accept store-review latency for every hotfix. Nothing to do.
- **Option B — adopt `expo-updates` with a self-hosted or EAS update server.**
  Must be done BEFORE the final store builds (it changes native config, so it
  cannot be added via OTA itself): `npx expo install expo-updates`, configure
  `updates.url` + `runtimeVersion` in `app.config.ts`, re-run
  `npx expo prebuild --clean`, and stand up the update server. Note this
  partially re-introduces the EAS/hosting dependency that was deliberately
  dropped — weigh against Option A's review latency.

## 7. Permissions rationale (store review)

- **iOS location strings** (`app.config.ts` → `ios.infoPlist`): explain
  foreground map/route usage and on-shift background delivery tracking.
  `UIBackgroundModes: ["location"]` is declared intentionally.
- **Android `ACCESS_BACKGROUND_LOCATION`**: declared intentionally and USED —
  background delivery tracking is implemented (`lib/backgroundLocation.ts`).
  See section 10 for the store review notes.
- Removed as unused: `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`.
- `LSApplicationQueriesSchemes` (`comgooglemaps`, `waze`, `maps`) allows the
  external-navigation handoff to probe installed map apps via `canOpenURL`.

## 8. App Transport Security (dev note)

`NSAllowsArbitraryLoads` was **removed** from the iOS config — production must
talk HTTPS only. If you need to hit a LAN backend from a local dev build over
plain HTTP, temporarily add to `ios.infoPlist` in `app.config.ts`:

```jsonc
"NSAppTransportSecurity": { "NSAllowsLocalNetworking": true }
```

Never ship `NSAllowsArbitraryLoads: true` — App Review rejects it without a
strong justification.

## 9. Known gaps / follow-ups

- **`expo-av` is deprecated** (removal expected in a future SDK); migrate sound
  playback to `expo-audio` before the next SDK upgrade.
- `favicon.svg` at the repo root is no longer referenced by the build; keep as
  a design source or delete. (`assets/images/icon.svg` / `zbr-logo.svg` were
  unreferenced too and have been deleted.)
- Replace the generated placeholder brand assets in `assets/images/`
  (`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`) with final
  marketing-approved artwork before launch if design provides one — sizes:
  1024x1024, 1024x1024 (transparent fg, ~66% safe zone), 1284x2778, 48x48.

## 10. Background location — store review notes

Background tracking is implemented in `lib/backgroundLocation.ts`
(`expo-task-manager` task `courier-location-task`, started/stopped from
`context/CourierContext.tsx` when the courier goes on/off shift). Both stores
review background location strictly:

### Google Play Console

- Complete the **background location declaration** (App content → Sensitive
  app permissions → Location). Declared feature: *real-time tracking of an
  on-shift delivery courier so dispatch and customers can follow active
  deliveries*. Tracking runs only while the courier has toggled themselves
  online and stops when they go offline or log out.
- Provide a **short demo video** (YouTube link) showing: the in-app prominent
  disclosure, the permission prompts (foreground then "Allow all the time"),
  the courier going online, and the persistent foreground-service notification
  ("ZBR Courier is on shift") while the app is backgrounded.
- The foreground service uses `FOREGROUND_SERVICE_LOCATION` (Android 14+
  requirement) — already declared in `app.config.ts`.

### App Store review

- In the App Review notes, justify `UIBackgroundModes: ["location"]` with
  something like: *"ZBR Courier is a delivery-driver app. While a courier is
  on shift, dispatch and customers track the delivery in real time. Couriers
  routinely hand off to external navigation apps (Google/Yandex/Apple Maps)
  mid-delivery, which backgrounds this app — location must keep flowing during
  that window. Tracking starts only when the courier taps 'Go online' and
  stops when they go offline or log out."*
- Provide a demo account with a way to go on shift so the reviewer can see
  the flow; `showsBackgroundLocationIndicator` is enabled so iOS shows the
  blue status-bar indicator while backgrounded.
- If background permission ("Always") is denied, the app degrades to
  foreground-only tracking — it never blocks the courier from working.

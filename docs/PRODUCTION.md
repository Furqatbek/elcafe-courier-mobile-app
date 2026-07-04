# Production Launch Checklist — ZBR Courier

Concise guide to building and submitting the app for stores. App config lives in
`app.config.ts` (converted from `app.json` so build-time secrets can be injected
from the environment). Build profiles live in `eas.json`.

## 1. Environment variables

### Build-time secrets (read by `app.config.ts`, NOT `EXPO_PUBLIC_*`)

These are evaluated when the Expo config is resolved. `EXPO_PUBLIC_*` is **not**
the mechanism for them — they must be set as [EAS secrets](https://docs.expo.dev/build-reference/variables/)
(`eas env:create` / project env vars on expo.dev) or exported in the shell that
runs the build.

| Variable | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Android Google Maps SDK key, injected into `android.config.googleMaps.apiKey` |
| `EAS_PROJECT_ID` | EAS project UUID, injected into `extra.eas.projectId` |
| `GOOGLE_SERVICES_JSON` | **REQUIRED for Android push.** Path to `google-services.json` (upload as an EAS *file* secret). If unset, `app.config.ts` falls back to `./google-services.json` in the repo root. When neither exists the config still evaluates (local dev convenience) but prints a warning and the build ships with **Android push notifications completely dead** — treat the warning as a release blocker. `eas.json` cannot carry comments, so this table is the canonical reminder. |

### Runtime client vars (`EXPO_PUBLIC_*`, inlined into the JS bundle)

Set per profile in `eas.json` — replace every `REPLACE_ME_*` value before building.

> **Guard:** `constants/config.ts` now throws at app startup in production
> builds if ANY consumed `EXPO_PUBLIC_*` value still contains `REPLACE_ME`
> (case-insensitive). A production build made from an unedited `eas.json`
> crashes immediately with the offending variable names instead of shipping
> with every network call silently pointed at a placeholder.

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

## 2. Google Maps (Android)

1. In Google Cloud Console, create/select a project and enable **Maps SDK for Android**.
2. Create an API key restricted to Android apps with package `app.zbr.courier`
   and the SHA-1 of your upload/signing certificate (`eas credentials` shows it).
3. Store it as an EAS secret: `eas env:create --name GOOGLE_MAPS_API_KEY --value <key> --environment production`
   (repeat for preview/development or scope accordingly).
4. iOS uses Apple Maps via `react-native-maps` default provider — no key required
   unless the Google provider is explicitly enabled on iOS.

## 3. Push notifications (FCM / APNs) — **RELEASE BLOCKER until done**

`app.config.ts` is already wired: it sets `android.googleServicesFile` to
`process.env.GOOGLE_SERVICES_JSON` (falling back to `./google-services.json`)
**only when that file actually exists**, so local dev without the secret still
works. The flip side: nothing fails the build when it's missing — the config
evaluation prints a `[app.config] ... Android push notifications will NOT
work` warning and the resulting Android binary has **zero push**. For a
courier app whose core loop is "get alerted to a new order with the phone in
your pocket", do not ship a build that printed that warning.

1. Create a Firebase project, add an Android app with package `app.zbr.courier`,
   and download `google-services.json`.
2. Provide the file to the build — either:
   - upload it as an EAS **file** secret named `GOOGLE_SERVICES_JSON`
     (`eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`), or
   - commit `google-services.json` to the repo root (it contains no private
     keys, only project identifiers — committing is Google's documented default).
3. Upload the FCM V1 service-account key to Expo: `eas credentials` → Android →
   Push Notifications (required for `expo-notifications` delivery via FCM).
4. iOS: `eas credentials` provisions the APNs key automatically during the first
   production build; make sure Push Notifications capability is enabled on the
   App ID. `ITSAppUsesNonExemptEncryption: false` is declared in
   `app.config.ts` so App Store Connect skips the export-compliance prompt.
5. **Backend contract check:** the app registers an `ExponentPushToken[...]`
   at `POST /api/v1/device-tokens` — the Spring backend must send via Expo's
   Push API, not raw FCM/APNs. See `docs/BACKEND_VERIFICATION.md` item on
   device tokens before launch.

## 4. EAS project ID

1. Run `eas init` (or create the project on expo.dev) to obtain the project UUID.
2. Set it in two places:
   - `EAS_PROJECT_ID` build-time secret → `extra.eas.projectId` in `app.config.ts`.
   - `EXPO_PUBLIC_PROJECT_ID` in each `eas.json` profile (used at runtime by
     `services/pushNotification.ts`).

## 5. Privacy Policy & Terms hosting

Both stores require a publicly reachable Privacy Policy URL (and App Store review
expects Terms for account-based apps). Host static pages on any HTTPS host
(e.g. company website, GitHub Pages, or the Spring backend as static resources)
and point `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` at them. The same
Privacy URL must be entered in App Store Connect and the Play Console listing.

## 6. Build & submit

```sh
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

`appVersionSource: remote` + `autoIncrement` in `eas.json` bump
`ios.buildNumber` / `android.versionCode` automatically on production builds
(the values in `app.config.ts` are the initial baseline).

## 6a. OTA updates (EAS Update) — explicit pre-launch decision required

**Current state: OTA is NOT available.** `expo-updates` is not installed, and
the `channel` keys that previously sat in `eas.json` build profiles have been
removed — without the package they were inert metadata that made it look like
OTA was configured when it wasn't. Consequence: **every JS fix ships as a full
store build + review cycle.** For a v1 launch to real couriers, that means a
bad-payload crash or locale bug stays live for however long store review takes.

Decide before launch, and record the decision here:

- **Option A — launch without OTA (current state).** Zero native-config risk.
  Accept store-review latency for every hotfix. Nothing to do.
- **Option B — adopt EAS Update.** Install path (do this BEFORE the final
  store builds — it changes native config, so it cannot be added via OTA
  itself):
  1. `npx expo install expo-updates`
  2. `eas update:configure` (writes `updates.url` + `runtimeVersion` policy
     into `app.config.ts`)
  3. Re-add `"channel": "development" | "preview" | "production"` to the
     matching build profiles in `eas.json`.
  4. Rebuild all profiles (the runtime version / updates URL are baked into
     the binary), then publish with `eas update --channel production`.
  5. Set a `runtimeVersion` policy of `"appVersion"` (safest with bare
     workflow-adjacent native deps like react-native-maps) so an OTA bundle
     never lands on an incompatible binary.

Do **not** install `expo-updates` casually right before submission: it adds
native modules on both platforms and changes startup behavior (update checks),
which deserves at least one full QA pass on physical devices.

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

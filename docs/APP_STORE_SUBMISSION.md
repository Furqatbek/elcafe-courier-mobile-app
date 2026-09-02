# App Store Connect submission — ZBR Courier

The iOS counterpart to `docs/PLAY_STORE_SUBMISSION.md`. Same app, different
review culture: Apple reviews the **running binary** by hand, and background
location plus a login wall are the two things they look at hardest.

Every claim below was verified against this repository. `[ACTION REQUIRED]`
marks something only a human with the Apple account can do.

Bundle identifier: **`app.zbr.courier`** (identical to Android; both are
permanent once shipped).

---

## 0. What will get this app rejected

Ordered by how likely it is to bite:

| # | Risk | Why it applies here |
|---|---|---|
| 1 | **Reviewer cannot get past the login** | Guideline 2.1. The entire app is behind auth, and couriers additionally need admin approval. Without working demo credentials this is an automatic rejection. See §2. |
| 2 | **Background location not justified** | Guideline 2.5.4 / 5.1.1. `UIBackgroundModes: location` must be demonstrably core to the app, and the reviewer must be able to *see* it working. See §3. |
| 3 | **App Privacy answers disagree with the binary** | Apple cross-checks the nutrition labels against the privacy manifest and observed traffic. See §4. |
| 4 | **Demo account has no seeded orders** | An empty app looks broken and cannot demonstrate the location feature at all. |
| 5 | **Missing account-deletion path** | Guideline 5.1.1(v). Required in-app for any app with account creation. We have it — §6. |

---

## 1. Prerequisites in App Store Connect

- [ ] `[ACTION REQUIRED]` Apple Developer Program membership, active.
- [ ] `[ACTION REQUIRED]` App ID `app.zbr.courier` created with the
      **Push Notifications** capability enabled. The `aps-environment:
      production` entitlement is already set in `app.config.ts`, but the
      capability must exist on the App ID or the entitlement fails to sign.
- [ ] `[ACTION REQUIRED]` APNs auth key (`.p8`) issued and given to the backend.
      The backend sends to APNs directly — the app never talks to Apple's push
      service itself.
- [ ] `[ACTION REQUIRED]` App record created in App Store Connect with the
      bundle id above.

**Sign in with Apple is NOT required.** Guideline 4.8 only applies when an app
offers third-party or social login. This app has email+password and phone OTP
only — verified: no `expo-auth-session`, no Google/Facebook sign-in packages in
`package.json`. If a social login is ever added, Sign in with Apple becomes
mandatory in the same release.

---

## 2. App Review sign-in information

App Store Connect → your app → the version → **App Review Information**.

- **Sign-in required:** Yes
- **User name:** `demo_courier@zbr.uz`
- **Password:** `Rcsda123!`

**Notes field** — paste this:

```
ZBR Courier is a closed app for delivery couriers working for our dispatch
service in Tashkent, Uzbekistan. All functionality is behind a login, and
courier accounts must additionally be approved by our operations team before
the app becomes usable. The account above is permanent and pre-approved, so it
goes straight to the Orders screen.

SIGN IN
1. Open the app and tap Skip on the onboarding screens.
2. Enter the email and password above on the login screen.
   Please ignore the "Log in with phone number" option — it sends an SMS code
   to Uzbek mobile numbers only. Email + password gives identical access.

SEEING THE CORE FEATURE (background location)
3. Tap the online/offline switch at the top of the Orders screen.
4. A disclosure screen explains that the app collects location while you are
   on shift, including in the background, and why. Tap Agree.
5. iOS then asks for location permission. Choose "Allow While Using App" —
   the app requests "Always" only later, when a delivery is actually active.
6. Available orders appear. Open one and tap Accept.
7. The map shows the route to the restaurant, and the courier's position is
   shared with dispatch and the customer for the duration of the delivery.
   This is why the app needs background location: couriers ride with the
   phone in a pocket or handlebar mount and frequently switch to an external
   navigation app mid-delivery, and dispatch must still be able to see them.
8. Location collection stops entirely when the courier goes offline.

The app collects no data for advertising or tracking, and contains no
third-party analytics or ad SDK.
```

`[ACTION REQUIRED]` before submitting, confirm server-side that the demo
account is verified, has 2–3 seeded available orders, and is **exempt from any
proximity filtering** — Apple reviews from California, and an empty order list
makes the app look broken and hides the location feature entirely.

---

## 3. Background location (the hard part)

`UIBackgroundModes: ["location", "fetch"]` in the generated `Info.plist`.
`location` is declared in `app.config.ts`; `fetch` is contributed by
`expo-task-manager`, which runs the background location task in
`lib/backgroundLocation.ts`.

Apple's bar: background location must be **necessary for the app's core
functionality**, disclosed, and visible to the user while active. This app:

- requests foreground permission first, and only asks for Always when a
  delivery is active (`components/LocationDisclosureModal.tsx` gates the very
  first request; `lib/backgroundLocation.ts:104-107` checks background
  permission separately and degrades to foreground-only if refused);
- shows the system location indicator — `showsBackgroundLocationIndicator: true`
  (`lib/backgroundLocation.ts:121`);
- stops tracking when the courier goes offline
  (`stopBackgroundLocationUpdates`, `:138-152`);
- throttles to one update per ~12 s and skips sends under ~20 m of movement.

Purpose strings are in `app.config.ts` and are specific rather than generic —
Apple rejects "Allow $(PRODUCT_NAME) to use your location."

> **Note the platform difference.** Google Play requires a separate
> declaration form *and* a demo video for background location. Apple has no
> equivalent form — the justification lives in the review notes above, and the
> reviewer judges the running app. The Play video is not needed here, but the
> §2 walkthrough is doing the same job.

---

## 4. App Privacy (the nutrition labels)

App Store Connect → App Privacy. These must agree with
`ios.privacyManifests` in `app.config.ts`, which prebuild writes to
`ios/ZBRCourier/PrivacyInfo.xcprivacy`.

**Do you or your third-party partners collect data from this app?** → Yes

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| **Precise Location** | Yes | Yes | No | App Functionality |
| **Name** | Yes | Yes | No | App Functionality |
| **Email Address** | Yes | Yes | No | App Functionality |
| **Phone Number** | Yes | Yes | No | App Functionality |
| **Device ID** | Yes | Yes | No | App Functionality |
| **Crash Data** | Only if `EXPO_PUBLIC_CRASH_ENDPOINT` is set | No | No | App Functionality |

Evidence for each:

- Precise location — `lib/backgroundLocation.ts` PUTs fixes to
  `/couriers/me/location`; foreground watcher in `context/CourierContext.tsx`.
- Name / email / phone — sent at registration (`app/register.tsx`) and returned
  by `GET /users/me`.
- Device ID — `services/pushNotification.ts` sends a persisted per-install
  `deviceId` and `deviceName` to `POST /device-tokens`.
- Crash data — `lib/crashReporting.ts` is a **no-op unless the endpoint is
  configured**, and the privacy manifest declares this type conditionally on the
  same env var. Keep the two answers in step: if you set the endpoint, tick
  Crash Data here too.

**Tracking: No.** `NSPrivacyTracking: false`, no tracking domains, and no ad or
analytics SDK exists in `package.json` (verified). Therefore **no App Tracking
Transparency prompt** and no `NSUserTrackingUsageDescription` are needed. Do not
add one — an ATT prompt with nothing behind it is itself a rejection reason.

`[ACTION REQUIRED]` Privacy Policy URL — the same page as Play:
`https://app.zbrr.uz/privacy`. It must be reachable without a login and from
outside Uzbekistan.

---

## 5. Privacy manifest — what is declared and why

Generated at `ios/ZBRCourier/PrivacyInfo.xcprivacy` from `app.config.ts`.
Required-reason APIs, with Apple's approved reason codes:

| Category | Reason | Used by |
|---|---|---|
| `FileTimestamp` | `C617.1` | expo-file-system, React Native asset handling |
| `UserDefaults` | `CA92.1` | AsyncStorage and Expo modules reading app-owned defaults |
| `SystemBootTime` | `35F9.1` | React Native / Hermes timing |
| `DiskSpace` | `E174.1` | expo-file-system writing to app storage |

Third-party SDKs ship their own manifests inside their frameworks; Xcode
aggregates them into the privacy report at archive time. After archiving,
**generate the privacy report** (Xcode → Organizer → right-click the archive →
Generate Privacy Report) and check nothing unexpected appears.

---

## 6. Account deletion — Guideline 5.1.1(v)

Required for any app that supports account creation, and Apple checks it.

In-app: **Settings → Delete Account**, which calls
`DELETE /api/v1/users/me` and then tears the session down
(`app/(tabs)/settings.tsx`). It is reachable in two taps from the main tab bar
and is not hidden behind a web view.

Apple, unlike Google, does **not** additionally require a public deletion URL —
but you are publishing one for Play anyway, so mention it in the review notes if
asked.

---

## 7. Store listing assets

| Field | Requirement | Notes |
|---|---|---|
| App name | ≤30 chars | "ZBR Courier" (11) |
| Subtitle | ≤30 chars | `[ACTION REQUIRED]` — Apple-only field, no Play equivalent |
| Promotional text | ≤170 chars | Optional, editable without a new build |
| Description | ≤4000 chars | Reuse the Play full description (`store-assets/listing-copy.json`) |
| Keywords | ≤100 chars, comma-separated | `[ACTION REQUIRED]` — Apple-only. No spaces after commas; do not repeat words already in the name |
| Support URL | Required | `[ACTION REQUIRED]` |
| Marketing URL | Optional | |
| Screenshots | 6.9" **and** 6.5" iPhone required | iPad not needed — `supportsTablet: false` |
| App icon | 1024×1024, **no alpha, no rounded corners** | `assets/images/icon.png` is already RGB with no alpha |

Localizations: en / ru / uz, matching the app's own languages. Uzbek is
available in App Store Connect; if a locale is unavailable, ship English and
Russian and note it.

**Age rating:** all content questions "None". No gambling, no user-generated
content shown to other users (the rating comment field is submitted to the
platform, not published in-app). Expected result: **4+**.

---

## 8. Export compliance

`ITSAppUsesNonExemptEncryption: false` is already declared in `app.config.ts`,
so App Store Connect skips the export questionnaire on every upload. This is
correct: the app uses only standard HTTPS/TLS, which is exempt.

---

## 9. Build the .ipa and upload with Transporter

**A Mac with Xcode is required.** Prebuild runs anywhere, but archiving and
code-signing an iOS app are macOS-only — there is no Windows or Linux path.

Verified names from a real prebuild: project `ios/ZBRCourier.xcodeproj`, scheme
**`ZBRCourier`**. The `.xcworkspace` does not exist until `pod install` has run —
after that, always open the **workspace**, never the project, or the CocoaPods
dependencies are missing.

### 9.1 Before every build

> ### Build numbers auto-increment
>
> `npm run prebuild` runs `scripts/bump-version.mjs` before prebuilding, so
> `android.versionCode` and `ios.buildNumber` both increase by one on every
> invocation. Both stores reject a build number they have already seen — even
> from a build you deleted — and forgetting to bump is the most common local
> release mistake.
>
> - `npm run prebuild` — Android, with bump
> - `npm run prebuild:ios` — iOS, with bump
> - `npm run prebuild:nobump` — no bump, for iterating during development
> - `npm run bump` — bump alone
>
> **Gaps are fine.** Stores require build numbers to *increase*, not to be
> contiguous, so prebuilding twice before an upload costs nothing. The
> user-visible `version` ("1.0.0") is deliberately NOT auto-incremented — that
> is a release decision. Pass it explicitly when it changes:
> `node scripts/bump-version.mjs 1.1.0`.
>
> Bumping edits `app.config.ts`, which is version-controlled — commit the change
> with the release so the number that shipped is recorded.


1. `.env` must be present at the repo root — `EXPO_PUBLIC_*` values are inlined
   into the JS bundle at build time, and a production build with placeholders
   throws at startup by design.
2. **Never bump the build number in Xcode.** Prebuild regenerates `Info.plist`
   from `app.config.ts`, so an edit made in Xcode is silently discarded on the
   next run. `npm run prebuild:ios` bumps it in the config for you (see the
   note above); if you archive without prebuilding, bump with `npm run bump`
   first. App Store Connect **rejects a `CFBundleVersion` it has already
   seen**, even from a build you deleted.

```bash
npm run prebuild:ios          # bumps ios.buildNumber, then prebuilds
cd ios && pod install && cd ..
```

### 9.2 Route A — Xcode (fewest moving parts)

```bash
open ios/ZBRCourier.xcworkspace
```

1. Select the **ZBRCourier** target → *Signing & Capabilities* → pick your Team.
   Leave *Automatically manage signing* on.
2. Confirm **Push Notifications** appears in the capabilities list. It comes
   from the `aps-environment: production` entitlement in `app.config.ts`, but
   signing fails unless the App ID has the capability enabled in the developer
   portal.
3. Set the run destination to **Any iOS Device (arm64)** — Archive is greyed out
   while a simulator is selected.
4. **Product → Archive.**
5. In Organizer: select the archive → **Distribute App** → **App Store Connect**
   → **Export** (not *Upload* — Export writes the `.ipa` to disk for Transporter).
6. Choose a destination folder. You get `ZBRCourier.ipa`.

While you are in Organizer, right-click the archive → **Generate Privacy
Report**. It aggregates your `PrivacyInfo.xcprivacy` with every SDK's own
manifest — check nothing unexpected is declared before you ship.

### 9.3 Route B — command line

Reusable and scriptable. Copy the export config out of `docs/` first, because
prebuild wipes `ios/`:

```bash
cp docs/ExportOptions.example.plist ExportOptions.plist
# fill in teamID (Apple Developer → Membership → Team ID)

xcodebuild -workspace ios/ZBRCourier.xcworkspace \
  -scheme ZBRCourier \
  -configuration Release \
  -archivePath build/ZBRCourier.xcarchive \
  -destination "generic/platform=iOS" \
  archive

xcodebuild -exportArchive \
  -archivePath build/ZBRCourier.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/ipa
```

The `.ipa` lands in `build/ipa/`.

### 9.4 Upload with Transporter

1. Install **Transporter** from the Mac App Store (free, by Apple).
2. Sign in with the Apple ID that has access to the app record. If the account
   has two-factor auth, generate an **app-specific password** at
   appleid.apple.com and use that, not the account password.
3. The app record must already exist in App Store Connect with bundle id
   `app.zbr.courier` — Transporter matches on it and rejects an unknown bundle.
4. Drag the `.ipa` in, or use **+** → *Add App*, then **Deliver**.
5. Transporter validates first. Common rejections at this stage: a reused
   `CFBundleVersion`, a missing Push Notifications capability on the App ID, or
   an icon with an alpha channel (ours is RGB with none — verified).
6. After delivery, the build takes roughly 5–30 minutes to appear under
   TestFlight while Apple processes it. You may get an email about missing
   compliance — ours is pre-answered by `ITSAppUsesNonExemptEncryption: false`.

### 9.4a "Upload Symbols Failed" for React / Hermes — expected, not a failure

After a successful delivery Apple often emails warnings like:

```
The archive did not include a dSYM for the React.framework with the UUIDs [...]
The archive did not include a dSYM for the ReactNativeDependencies.framework ...
The archive did not include a dSYM for the hermes.framework ...
```

**This does not block the upload, TestFlight, or App Review.** The build
processes normally and is submittable. Do not rebuild because of it.

**Why it happens.** React Native 0.81 no longer compiles its core on your
machine: `React`, `ReactNativeDependencies` and `hermes` arrive as prebuilt
XCFrameworks (React core and the dependency bundle are fetched from Maven,
Hermes as a release tarball — see
`node_modules/react-native/scripts/cocoapods/rncore.rb` and
`rndependencies.rb`). Prebuilt binaries ship without debug symbols, so the
archive has no dSYM to hand Apple. It is a property of how RN is distributed,
not of this project's configuration.

**What it costs.** Only crashes occurring *inside React Native's own native
frames* come back unsymbolicated in App Store Connect. Your app's code
(`ZBRCourier`) still has its dSYM and symbolicates normally, and JavaScript
stack traces are unaffected — those come from the Hermes bytecode map, not
from these dSYMs. For most triage you lose nothing.

**If you want them anyway**, build React Native from source instead of using
the prebuilt artifacts. Verified flag names for the RN version in this repo —
anything other than `"1"` selects a source build:

```bash
cd ios
RCT_USE_PREBUILT_RNCORE=0 RCT_USE_RN_DEP=0 pod install
cd .. && open ios/ZBRCourier.xcworkspace   # then archive as usual
```

The cost is a much longer clean build (tens of minutes instead of a few) on
every machine and every CI run. Hermes has its own prebuilt tarball and may
keep warning even then; that one is cosmetic.

**Do not** silence the emails by setting `uploadSymbols` to `false` in
`ExportOptions.plist`. That stops symbol upload for *your own* code too, which
is the half you actually need when a courier's phone crashes in the field.

### 9.5 TestFlight before App Review

Internal TestFlight testing needs no review and is the only realistic way to
confirm the two things that have never run on real hardware: **APNs push
delivery** (the backend sends to the raw APNs token from
`getDevicePushTokenAsync`, with `apns-topic` = `app.zbr.courier`) and
**background location** under real iOS suspension. Do this before submitting for
review — a rejection round-trip costs days, a TestFlight install costs minutes.

## 10. Definition of done

- [ ] TestFlight build installs on a physical iPhone
- [ ] Demo account signs in and reaches the Orders screen without approval limbo
- [ ] Disclosure → permission → online → accept → deliver runs end to end
- [ ] A push arrives from the backend via APNs with the app backgrounded
      (this is the path that has never been exercised — the app sends the raw
      APNs token from `getDevicePushTokenAsync`, and `appId` must equal
      `app.zbr.courier` or APNs rejects the `apns-topic`)
- [ ] Privacy report generated from the archive shows nothing unexpected
- [ ] App Privacy answers match §4 exactly

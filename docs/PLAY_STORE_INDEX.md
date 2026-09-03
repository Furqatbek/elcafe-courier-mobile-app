> **iOS:** this index covers Google Play. The App Store Connect counterpart is
> `docs/APP_STORE_SUBMISSION.md` — different forms, different review culture,
> and one hard iOS-only requirement (the privacy manifest, already wired into
> `app.config.ts`). The developer-account gate below is Play-specific; Apple has
> no equivalent testing requirement.

# ZBR Courier — Google Play production release: START HERE

This is the single entry point for the whole submission. Work top to bottom. Everything else is a
reference you open when this file sends you there.

---

# ⛔ STEP 0 — ANSWER THIS BEFORE YOU DO ANYTHING ELSE

## `[ACTION REQUIRED: confirm the Play developer account's TYPE and CREATION DATE — today.]`

**This one answer decides whether you can reach production in days or in weeks.** It is the only item
on the entire list that can add **three or more weeks you cannot compress**, and it is invisible from
the codebase — no amount of engineering work substitutes for it. Nobody should write release code,
record a demo video, or promise the business a launch date until this is answered in writing.

Find it in **Play Console → Setup → Developer account → Account details** (account type) and the
account's creation date on the same page or in your original signup email.

| If the account is… | Then |
|---|---|
| **Personal, created ON or AFTER 13 November 2023** | ⛔ **BLOCKED on a 14-day clock.** Before you may apply for production access you must run a **closed test with at least 12 testers opted in continuously for at least 14 days**. Then you *apply* for production access and Google reviews it — *"Review usually takes seven days or less, but can occasionally take longer."* Testers who opt in, test briefly and opt out **do not count**. Realistically **3–4 weeks** before a production release is possible at all. → go to §0.1 |
| **Personal, created BEFORE 13 November 2023** | Exempt from the 12-tester rule. Still needs identity verification. → go to STEP 1 |
| **Organization** (company) | Exempt from the 12-tester rule. You needed a **D-U-N-S number** to create the account — free from Dun & Bradstreet but the request can take **up to 30 days**, so if the account does not exist yet, start that today. Your Google payments profile legal name and address must **match** the D-U-N-S record; a mismatch triggers a correction deadline and, if missed, account restriction and removal of all apps. → go to STEP 1 |

Source (read 2026-08-22): <https://support.google.com/googleplay/android-developer/answer/14151465>
— *"a minimum of 12 testers who have been opted in continuously for at least 14 days"*, applying to
personal accounts created after November 13, 2023. **[RE-CHECK]** before you plan the launch date: this
was reduced from 20 testers on 11 December 2024, so assume the number can change again. Account
creation requirements incl. D-U-N-S:
<https://support.google.com/googleplay/android-developer/answer/13628312>.

> **If the 12-tester rule applies and nobody knew, tell the business today.** A courier operations team
> that has been told "the app goes live next week" needs to hear this in week one, not week three.

### 0.1 If the 12-tester rule applies — start recruiting now

`[ACTION REQUIRED: collect ≥12 real Google account emails and put them in a Play Console email list.]`

You need 12 real Google accounts that opt in **and stay opted in** for 14 consecutive days. Your own
couriers are the obvious pool and give you genuine shift testing at the same time. Collect the
addresses **before the first build exists** — the clock cannot start until they are opted in, and every
day you spend recruiting is a day added to the launch date.

### 0.2 Run the long poles in parallel

This app's *other* long pole is the background-location declaration, which is also a manual human
review. If you are on a new personal account, the 12-tester clock and the location review can run **at
the same time** — but only if you start the closed test immediately. Sequencing them costs you a month.

| Track | Start when | Runs for |
|---|---|---|
| D-U-N-S request (org accounts that do not exist yet) | today | up to 30 days |
| 12-tester closed test (new personal accounts) | the first uploadable AAB | **14 days minimum**, then a production-access application |
| Background-location declaration review | as soon as App content is complete on **any** track | days per round-trip |
| Privacy policy + account-deletion page hosting (STEP 2) | today | your web team |
| ≤30 s demo video (STEP 3) | once the Maps key is in and the map renders | one afternoon |

---

# STEP 1 — Fix the build blockers

Full evidence, with `file:line` citations, in
[`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md) §1–§2. These were re-verified against the
current tree on 2026-08-22.

## 1.1 Secrets and environment — all `[ACTION REQUIRED]`, none can come from this repo

Set every one of these in the shell that runs `npx expo prebuild` **and** Gradle. Expo inlines
`EXPO_PUBLIC_*` at bundle time, so a value set after bundling has no effect.

- [ ] `[ACTION REQUIRED]` **`GOOGLE_MAPS_API_KEY`** — Maps SDK for Android key, restricted to
      `app.zbr.courier` **plus the Play app-signing SHA-1** (not only your upload key). Unset, the
      resolved value is `""`, the manifest meta-data is omitted, and every map is grey. `app.config.ts`
      warns but does not fail the build. → SUBMISSION §1.5
- [ ] `[ACTION REQUIRED]` **`google-services.json` at the repo root** — without it Android push is dead
      *and* `getDevicePushTokenAsync()` throws at runtime. The config warns and continues. → §1.9
- [ ] `[ACTION REQUIRED]` **`EXPO_PUBLIC_RORK_API_BASE_URL`** — an `https://` origin. A production
      build with it unset **throws at module load** and the app will not start. → §1.4
- [ ] `[ACTION REQUIRED]` **`EXPO_PUBLIC_ROUTING_URL`** — a routing host **you operate**. Unset in
      production, route polylines silently disappear (no data leaks, but the map looks broken on your
      demo video). → §4 Note A
- [x] **`EXPO_PUBLIC_PRIVACY_URL` — DECIDED: `https://app.zbrr.uz/privacy`.** Put it in `.env`.
      Setting it also lights up the in-app privacy link in `app/onboarding.tsx:165` at zero extra
      cost, which is what Play's User Data policy expects for an app handling location and phone
      numbers — so there is nothing to "skip" here. Just confirm the URL is publicly reachable
      (no login wall, no geo-block) before you submit.

- [ ] `[ACTION REQUIRED]` **Decide on `EXPO_PUBLIC_CRASH_ENDPOINT`.** Set = crash reports POST to your
      own endpoint → Data safety **Crash logs: Yes**. Unset = nothing leaves the device → **No**. Decide
      *before* filing the form. → §1.3
- [ ] `[ACTION REQUIRED]` **Upload keystore** — generate it, back it up **off the build machine**, and
      record the passwords in a password manager. `plugins/withAndroidReleaseSigning.js` reads the
      `ZBR_UPLOAD_*` Gradle properties; without them the build silently falls back to the **debug**
      keystore and produces an unuploadable artifact that still "succeeds". → `ANDROID_RELEASE.md`

## 1.2 Code and dependency blockers

- [ ] **`expo-dev-client` is a production dependency.** It autolinks `expo-dev-launcher`, whose
      `implementation`-scoped Gradle deps pull Google's **code-scanner** and **ML Kit barcode-scanning**
      SDKs into the release AAB — third-party SDKs nothing in this app uses and your Data safety form
      does not account for. Move it to `devDependencies`. → §1.3
- [ ] **`RECORD_AUDIO` / `FOREGROUND_SERVICE_MEDIA_PLAYBACK` / `SYSTEM_ALERT_WINDOW` are *blocked*, not
      absent.** The strip depends on a manifest-merge directive. Verify on the built artifact with
      `aapt2 dump permissions`, don't assume. → §1.8
- [ ] `[ACTION REQUIRED]` **`SUPPORT_EMAIL` / `SUPPORT_PHONE`** (`constants/config.ts:270-271`) are
      still placeholders (`support@courierapp.com`, `+998901234567`) and
      `app/verification-pending.tsx` opens both. A reviewer emailing a dead address during app-access
      review will fail you.
- [ ] `[ACTION REQUIRED]` **Two help-centre strings point at UI that does not exist**, in all three
      locales — your own app misdirecting the user is a deceptive-behaviour finding:
      - *"Go to the Earnings tab and tap 'Withdraw Funds'"* — there is no withdrawal control in
        `app/(tabs)/finance.tsx`. → §9.3
      - *"Go to Settings > Security > Delete Account"* — `/security` now redirects to Settings; the real
        path is **Settings → Delete Account**. → §6.1

## 1.3 Things earlier notes called blockers that are NOT — do not re-open them

Every item here was verified working in the current tree. If a checklist, ticket, or hand-off note
tells you otherwise, it was written against a stale checkout. **Re-verify with the command shown rather
than trusting either source.**

| Claim you may have been given | Reality | Verify with |
|---|---|---|
| "No prominent-disclosure screen exists" | `components/LocationDisclosureModal.tsx` exists, is wired into the online toggle, and its copy **meets Google's stated requirements** — see §5.3 for the actual copy judged clause by clause. Translated en/ru/uz. | `grep -rn "LocationDisclosure" app components` |
| "Background location is declared but not implemented" | Fully implemented: `lib/backgroundLocation.ts` defines a real `expo-task-manager` task, started via `Location.startLocationUpdatesAsync` with an Android **foreground service** and a persistent notification. → §5.1 | `grep -n "startLocationUpdatesAsync\|defineTask\|foregroundService" lib/backgroundLocation.ts` |
| "Push uses Expo's push service / `projectId` is unset / EAS is gone so it throws" | Wrong on all counts. `services/pushNotification.ts:86` calls **`getDevicePushTokenAsync()`** — the native **FCM** token on Android, raw APNs on iOS. There is no `projectId`, no `eas.json`, and no Expo push service anywhere in the repo. The backend sends via Firebase Admin with its own keys. → §1.9 | `grep -n "getDevicePushTokenAsync\|getExpoPushTokenAsync\|projectId" services/pushNotification.ts` |
| "Delete Account is a stub that lies to the user" | Real: `app/(tabs)/settings.tsx:184-186` sends `DELETE /api/v1/users/me`, throws on a non-OK response, and on success runs `await logout()` then `router.replace('/login')` (`:199-200`). `app/security.tsx` is an inert `<Redirect>`. → §6.1 **The separate web deletion URL is still required — STEP 2.** | `grep -n "users/me'" "app/(tabs)/settings.tsx"` |
| "Privacy Policy link opens `https://google.com`" | Gone. `app/onboarding.tsx:27` reads `EXPO_PUBLIC_PRIVACY_URL` and `:165` renders the link **only when it is set**. The real gap is that you must publish a policy and set the variable. → §10.2 | `grep -n "PRIVACY_URL" app/onboarding.tsx` |
| "`BASE_URL` defaults to `http://localhost:8080` in production" | The localhost fallback is reachable **only under `__DEV__`**; a production build with the var unset throws at module load (`constants/config.ts:78`). TLS is enforced by `enforceSecureTransport` (`:23-28`). → §1.4 | `grep -n "resolveBaseUrl\|enforceSecureTransport" constants/config.ts` |
| "Precise location is sent to `router.project-osrm.org`" | The public demo host is `__DEV__`-only (`lib/routing.ts:51,65`). In production the routing base is your own `EXPO_PUBLIC_ROUTING_URL` or `null`. Answer **Shared: No** for both location rows. → §4 Note A | `grep -n "DEMO_ROUTING_URL\|__DEV__" lib/routing.ts` |
| "`app.json` still exists and lists different permissions" | **There is no `app.json`.** `app.config.ts` is the sole config source; the resolved config's `_internal.staticConfigPath` is `{}`. | `ls app.json` |
| "The `android/` directory is stale and ships blocked permissions" | There is no `android/` directory — it is generated output. Run `npx expo prebuild --platform android --clean` before every release build. | `ls -d android` |
| "Chat / order rating are simulated, so don't advertise them" | Half right, for new reasons. **Chat does not exist at all** (`app/chat.tsx` is a `<Redirect>`) — still do not advertise it. **Order rating IS wired** (`app/order-rating/[orderId].tsx:74` submits via `authenticatedFetch`) — you may describe it. → §8.1, §10.1 | `head -12 app/chat.tsx` |
| "Reviewers can't reach the OTP screen, so no OTP handling is needed" | **Wrong, and it matters.** `app/login.tsx:108` renders a "Log in with phone number" button one tap from the login form. Your App access notes must explicitly tell the reviewer to use email + password and ignore it. → §3.1, §3.3 | `grep -rn "login-otp" app/` |
| "Photos are collected via report-issue / profile avatar" | No photo collection anywhere. `expo-image-picker` has been removed, `app/report-issue.tsx` is a `<Redirect>`, and `app/edit-profile.tsx` collects name/email/phone only. Data safety **Photos: No**. → §4 Note B | `grep -rn "ImagePicker" --include=*.tsx . \| grep -v node_modules` |

**Health of the tree, verified 2026-08-22:** `npx tsc --noEmit` → 0 errors; `npx jest` → **84 passed,
6 suites, 0 failures**.

---

# STEP 2 — Publish the two web pages (start on day one; they are not yours to write)

Both are URLs Play fetches or a reviewer opens, and **neither can be satisfied from inside this repo**.
Hand them to whoever runs your website today — they are almost always the thing that ends up blocking
an otherwise-ready submission.

- [ ] `[ACTION REQUIRED: publish a privacy policy at https://…/privacy]`
      Must be public (not behind a login), must explicitly state that **precise location is collected in
      the background while the courier is online**, must name Google/Firebase as the push and maps
      service provider, must name your routing host, must state retention periods, and must **not
      contradict the Data safety form** — the two are cross-checked. Goes into **both** Play Console and
      the `EXPO_PUBLIC_PRIVACY_URL` build variable. → SUBMISSION §10.2
- [ ] `[ACTION REQUIRED: publish an account-deletion page at https://…/delete-account]`
      Required **in addition to** the in-app deletion, which already works. Must be usable **without
      installing the app and without logging in**. Ready-to-publish draft copy, including the
      what-is-deleted / what-is-retained sections, is in SUBMISSION §6.3. → §6.2

---

# STEP 3 — Record the ≤30 second demo video

Only after the Maps key is in (STEP 1.1) — a grey map ruins the recording.

- [ ] `[ACTION REQUIRED: record, upload as YouTube **Unlisted**, verify in an incognito window]`

Google's guidance is explicit: **"Aim for a video duration of 30 seconds or less."** The video must show
the feature being activated from the background, the prominent in-app disclosure dialog, and the runtime
prompt (<https://support.google.com/googleplay/android-developer/answer/9799150>, read 2026-08-22).

**A six-shot, 30-second script is in SUBMISSION §5.4.** If you have been handed an older 90–150 second,
ten-shot script, discard it — it is roughly four times too long and buries the three things the reviewer
is actually checking for.

Two things that fail this outright: **Private** visibility on YouTube (reviewers are not on your
allow-list and cannot open it — verify in incognito), and an **emulator** recording (the permission
dialogs look subtly wrong and reviewers notice).

---

# STEP 4 — Build and verify the AAB

Follow [`ANDROID_RELEASE.md`](./ANDROID_RELEASE.md) §1–§4 exactly. The short form:

```bash
cd /home/user/elcafe-courier-mobile-app
ls -l google-services.json                       # must exist
export GOOGLE_MAPS_API_KEY="…"
export EXPO_PUBLIC_RORK_API_BASE_URL="https://api.your-domain.com"
export EXPO_PUBLIC_ROUTING_URL="https://osrm.your-domain.com"
export EXPO_PUBLIC_PRIVACY_URL="https://your-domain.com/privacy"
npm ci
npm run prebuild                                 # bumps versionCode, then prebuilds
cd android && ./gradlew :app:bundleRelease && cd ..
./scripts/verify-aab.sh android/app/build/outputs/bundle/release/app-release.aab
```

- [ ] Watch the prebuild log for the two `[app.config]` warnings (missing `google-services.json`,
      missing `GOOGLE_MAPS_API_KEY`). Neither is fatal; both mean **do not upload this build**.
- [ ] Signer is **not** `CN=Android Debug`.
- [ ] `versionCode` strictly greater than anything ever uploaded (`node scripts/bump-version.mjs`).
- [ ] Every `.so` LOAD segment aligns to `0x4000` or greater (16 KB pages).
- [ ] `aapt2 dump permissions` on the artifact shows no `RECORD_AUDIO`,
      `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `SYSTEM_ALERT_WINDOW`, `CAMERA`, `READ_MEDIA_IMAGES`, `AD_ID`.
- [ ] No `devlauncher` / `devmenu` / `mlkit` / `codescanner` entries in the AAB (STEP 1.2).

> `scripts/verify-aab.sh:161-179` encodes an expected-permission list that omits
> `RECEIVE_BOOT_COMPLETED`, which **will** legitimately be in the merged manifest (from
> `expo-notifications`, justified in SUBMISSION §7.1). Expect that warning; **do not** "fix" it by
> blocking the permission.

---

# STEP 5 — Play Console

Order matters: create the app, fill App content, then upload.

## 5.1 At app creation — irreversible choices

- [ ] **Pricing: Free.** Set at creation. A free app can **never** be changed to paid.
- [ ] **Enrol in Play App Signing.** Mandatory for new apps and the only compulsory integrity mechanism
      in this path. (Play Integrity API is opt-in, needs server-side verification you have not built —
      skip it for v1. "Automatic protection" changes the delivered binary — do not enable it in the same
      release you are trying to get through a first review.)
- [ ] `[ACTION REQUIRED: decide distribution countries/regions.]` Nothing in these documents names one.
      This is a Tashkent-market workforce app; publishing to all countries is the default and is almost
      certainly **not** what you want. Set it per track under **Test and release → <track> →
      Countries/regions**. Restricting distribution does **not** hide the app from reviewers.
- [ ] US export laws + Play developer program policy declarations.
- [ ] Turn on **Managed publishing** if you want to control the exact go-live moment.

## 5.2 Store presence → Main store listing

Copy from [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md); policy constraints on what you may claim
are in SUBMISSION §10.1.

- [ ] App name / short description / full description, en-US + ru-RU + uz
- [ ] `store-assets/play-icon-512.png`, `store-assets/feature-graphic-1024x500.png`
- [ ] 2–8 phone screenshots per locale — longest side ≤ 2× the shortest. Capture from the seeded demo
      account; never ship a grey map or an empty Available list, and fake the customer names.
- [ ] `[ACTION REQUIRED: public contact email, phone, website]` — use the same monitored address as
      `SUPPORT_EMAIL`.
- [ ] Category **Business**; tags from Play's fixed list.

## 5.3 App content — every answer is in SUBMISSION

- [ ] Privacy policy URL (STEP 2)
- [ ] **App access → "Some functionality restricted"** + the ready-to-paste block in §3.3.
      `[ACTION REQUIRED: permanent pre-verified demo courier account + seeded orders + earnings, and a
      backend proximity-filter exemption so a reviewer outside Uzbekistan sees offers.]` This is the
      single most common rejection for courier apps — SUBMISSION §3.2 lists all five provisioning steps.
- [ ] Ads → **No** · Advertising ID → **No** (Console asks both; they are different questions)
- [ ] Content rating questionnaire → §8
- [ ] Target audience → **18+ only**
- [ ] News → No · COVID-19 → No · Government apps → No · Health → No
- [ ] **Financial features → No** — cash-on-delivery is not a financial feature; keep the §9.3
      paragraph on file in case a reviewer queries it
- [ ] **Data safety** → the full §4 table. Note the two answers that hinge on decisions you make in
      STEP 1.1: *Crash logs* (depends on `EXPO_PUBLIC_CRASH_ENDPOINT`) and *encryption in transit* (Yes,
      given a production build with the base URL set).
- [ ] **Data deletion URL** (STEP 2)
- [ ] **Sensitive app permissions → Location permissions declaration** + the ≤30 s video (STEP 3).
      Justification text in §5.2.
- [ ] **Foreground service permissions declaration**, `location` type — a *separate* form from the
      location declaration; text in §7.2. You can reuse the same video.

---

# STEP 6 — Tracks and rollout

Internal testing → Closed testing → Production. Detail in `ANDROID_RELEASE.md` §5 and SUBMISSION §11.

- [ ] Internal testing release installed on real Android 12 / 14 / 16 devices
- [ ] Pre-launch report clean (it also surfaces the 16 KB page-size warning)
- [ ] **Closed test: ≥12 testers, ≥14 continuous days if STEP 0 says so** — then submit the
      production-access application and wait for Google's review. Otherwise, at least a week of real
      courier shifts: doze mode and OEM battery savers killing the foreground service are the bugs you
      cannot find on a desk.
- [ ] Location declaration reads **approved** in App content *before* you schedule the launch
- [ ] Production rollout started **staged at 5%**, then 10 → 20 → 50 → 100, a day at each step

---

## Document map

| Document | What it answers | Used at |
|---|---|---|
| **this file** | Order of operations, developer-account gating, every human action item | Now, and as the tick-list |
| [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md) | Every Play Console **App content** form answered from the code: Data safety, background location + video script, App access, permissions, content rating | STEP 1, 3, 5 |
| [`ANDROID_RELEASE.md`](./ANDROID_RELEASE.md) | Toolchain, keystore, `prebuild` + Gradle, AAB verification, upload, version bumping | STEP 4, 6 |
| [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md) | Store listing copy (en/ru/uz), graphics, screenshot runbook | STEP 5.2 |
| [`PRODUCTION.md`](./PRODUCTION.md) | Environment variables and the launch checklist | STEP 1.1, 4 |

Machine-readable listing copy: [`../store-assets/listing-copy.json`](../store-assets/listing-copy.json)
(gate: `python3 store-assets/check_copy.py`). AAB gate:
[`../scripts/verify-aab.sh`](../scripts/verify-aab.sh). Version bump:
[`../scripts/bump-version.mjs`](../scripts/bump-version.mjs).

> **A note on cross-document drift.** `PLAY_STORE_LISTING.md` and `ANDROID_RELEASE.md` are not owned by
> this file and contain `file:line` citations that predate recent edits to `app.config.ts` and
> `package.json`. The *values* they cite are generally still right; the *anchors* may not be. Re-grep
> rather than trusting a line number, and treat the resolved config
> (`npx expo config --type prebuild --json`) as authoritative over any document, this one included.

---

## Date-dependent items, and how to re-check each

**Play Console → Policy → Program updates** is the only source specific to *your* account and is never
stale. The pages below are the general policy.

| Item | Answer as read 2026-08-22 | Re-check at |
|---|---|---|
| New personal account testing rule | **12 testers / 14 continuous days**, then a production-access application (was 20 testers until 11 Dec 2024) | <https://support.google.com/googleplay/android-developer/answer/14151465> |
| Background location video | **"30 seconds or less"**; must show the disclosure, the runtime prompt, and the feature active from the background | <https://support.google.com/googleplay/android-developer/answer/9799150> |
| Prominent disclosure wording | Must contain "location", one of *background* / *when the app is closed* / *always in use* / *when the app is not in use*, and list every feature using background location. The shipped copy satisfies all three — SUBMISSION §5.3 | same page |
| Data safety form, incl. the service-provider carve-out from "sharing" | See SUBMISSION §1.3 and §4 | <https://support.google.com/googleplay/android-developer/answer/10787469> |
| Target API level | This build inherits API **36** from React Native's Gradle catalog (`expo-build-properties` is not installed, so it is not pinned — an RN downgrade would move it) | <https://developer.android.com/google/play/requirements/target-sdk>, plus an upload attempt, which names the required level in the error |
| 16 KB page sizes | Required for apps targeting API 35+ | <https://developer.android.com/guide/practices/page-sizes>, plus the pre-launch report |
| Screenshot / graphic constraints | 2–8 phone shots, 320–3840 px sides, longest ≤ 2× shortest, no alpha | <https://support.google.com/googleplay/android-developer/answer/9866151> — and the Console uploader, which states the exact numeric reason on rejection |
| Android vitals thresholds | Crash 1.09%, ANR 0.47% overall; 8% per model over 28 days | <https://developer.android.com/topic/performance/vitals> |

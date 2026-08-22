# ZBR Courier — Google Play production release: master index

**Read this first.** It is the running order for the whole submission and the map to the
three detailed documents. It also carries the items that live in **none** of them
(§A), and the errata that correct them where I found them wrong (§B).

| Document | What it answers | When you use it |
|---|---|---|
| **this file** | Order of operations, developer-account gating, cross-doc errata | Now, and as the tick-list |
| [`ANDROID_RELEASE.md`](./ANDROID_RELEASE.md) | Toolchain, keystore, `prebuild` + Gradle, AAB verification, upload, version bumping | Phase 3–4 |
| [`PLAY_STORE_SUBMISSION.md`](./PLAY_STORE_SUBMISSION.md) | Every Play Console **App content** form: Data safety, background location, App access, content rating, permissions | Phase 2 and 5 |
| [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md) | Store listing copy (en/ru/uz), graphics, screenshot runbook | Phase 5 |

Machine-readable listing copy: [`../store-assets/listing-copy.json`](../store-assets/listing-copy.json)
(gate: `python3 store-assets/check_copy.py`).
AAB gate: [`../scripts/verify-aab.sh`](../scripts/verify-aab.sh). Version bump:
[`../scripts/bump-version.mjs`](../scripts/bump-version.mjs).

Markers used below: **[BLOCKER]** stops the release · **[ACTION REQUIRED]** needs a human
decision or secret · **[RE-CHECK]** policy that moves on Google's schedule, not ours.

---

## Phase 0 — the developer account (start today; it can cost weeks)

None of the three documents covers this, and it is the only item on the whole list that
can add **three or more weeks** you cannot compress. Start it before you write a line of
release code.

### 0.1 Which account type are you publishing from?

`[ACTION REQUIRED: state the Play developer account's type and creation date, and record it here.]`

This single answer decides whether you can ship to production at all this quarter.

| If the account is… | Then |
|---|---|
| **Organization** (company) | You needed a **D-U-N-S number** to create it. Dun & Bradstreet issue it free but the request can take **up to 30 days**. Your Google payments profile legal name/address must **match** the D-U-N-S record — a mismatch triggers a correction deadline and, if missed, account restriction and removal of all apps. Organization accounts also verify **both** developer email and phone by one-time code. Organization accounts are **exempt** from §0.2. |
| **Personal, created on or after 13 November 2023** | **[BLOCKER]** You must run a **closed test with at least 12 testers opted in continuously for at least 14 days**, then *apply* for production access; Google says that review takes **seven days or less**. Testers who opt in, test briefly and opt out do not count. Realistically **3–4 weeks** before a production release is even possible. |
| **Personal, created before 13 November 2023** | Exempt from §0.2; still needs identity verification. |

Sources (read 2026-08-22 — **[RE-CHECK]** before you plan the launch date):
- Testing requirement: <https://support.google.com/googleplay/android-developer/answer/14151465>
  — "a minimum of **12 testers** who have been opted in continuously for at least **14 days**",
  applying to personal accounts "created after November 13, 2023". (This was reduced from
  20 testers on 11 December 2024; assume the number can change again.)
- Account creation requirements incl. D-U-N-S: <https://support.google.com/googleplay/android-developer/answer/13628312>
- Identity verification: <https://support.google.com/googleplay/android-developer/answer/10841920>

**Why this matters more here than for a typical app.** ZBR Courier's other long pole is
the background-location declaration, which is a manual human review. If you are on a new
personal account, the 12-tester/14-day clock and the location review can run **in
parallel** — but only if you start the closed test immediately. Sequencing them costs you
a month. See §0.3.

> **If §0.2 applies and nobody knew, tell the business today.** A courier operations team
> that has been told "the app goes live next week" needs to hear this now, not in week
> three. `PLAY_STORE_SUBMISSION.md` §11 recommends a closed test "for a week"; if the
> 12/14 rule applies, a week is not enough and the tester count is not optional.

### 0.2 Recruit the testers now, if applicable

You need **12 real Google accounts** that opt in and stay opted in for 14 consecutive
days. Your own couriers are the obvious pool and give you genuine shift testing at the
same time. Collect the Gmail addresses into a Play Console email list before the first
build exists. `[ACTION REQUIRED: list of ≥12 tester Google account emails]`

### 0.3 Parallelise

| Track | Start when | Runs for |
|---|---|---|
| D-U-N-S request (org accounts only) | today | up to 30 days |
| 12-tester closed test (new personal accounts only) | first uploadable AAB | 14 days minimum |
| Background-location declaration review | as soon as App content is complete on **any** track | days, per round-trip |
| Privacy policy + deletion page hosting (§3) | today | your own web team |
| Demo video recording (§3) | after the code blockers are fixed | one afternoon |

---

## Phase 1 — code blockers (nothing else matters until these are done)

Every item is verified against the tree as it stands. Full evidence in
`PLAY_STORE_SUBMISSION.md` §1–§2.

- [ ] **[BLOCKER] Background location is declared but not implemented.** The resolved
      config emits `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
      `FOREGROUND_SERVICE_LOCATION`, but there is no `requestBackgroundPermissionsAsync`,
      no `startLocationUpdatesAsync`, no TaskManager task, and `expo-task-manager` is not
      a dependency. **Decide now: implement it, or turn it off** by setting
      `isAndroidBackgroundLocationEnabled: false` and `isAndroidForegroundServiceEnabled:
      false` in the `expo-location` plugin block. Turning it off also removes the demo
      video, the location declaration and the FGS declaration from your critical path —
      the single biggest schedule saving available. **If you turn it off you must also**
      strip the "even when the app is closed or not in use" paragraph from all three
      locales in `store-assets/listing-copy.json` **and** relax
      `store-assets/check_copy.py`, which currently *fails the build* if that sentence is
      absent (see §B4).
- [ ] **[BLOCKER] No prominent-disclosure screen exists.** `components/` contains no
      disclosure component and `i18n/locales/*.json` contain no disclosure strings. The
      permission request fires with nothing shown first. Required only if background
      location stays. Google's stated requirements (see §A5) are strict about wording,
      timing and the decline option.
- [ ] **[BLOCKER] Delete Account is a stub that lies.** `app/security.tsx` shows
      *"Your account deletion request has been submitted"* and calls no API;
      `constants/config.ts` has no delete endpoint. Wire it to a real `DELETE`, or remove
      the button. Shipping it as-is is a Deceptive Behavior violation on top of the
      account-deletion requirement.
- [ ] **[BLOCKER] Privacy Policy link opens `https://google.com`** (`app/onboarding.tsx:79`).
- [ ] **[BLOCKER] No Google Maps API key.** The generated manifest contains no
      `com.google.android.geo.API_KEY` meta-data, so the map renders grey in release.
      `[ACTION REQUIRED: Maps SDK for Android key, restricted to app.zbr.courier + the
      Play app-signing SHA-1, added as android.config.googleMaps.apiKey]`
- [ ] **[BLOCKER] Push is dead.** `services/pushNotification.ts` calls
      `getExpoPushTokenAsync({ projectId: process.env.EXPO_PUBLIC_PROJECT_ID })`; EAS is
      gone so `projectId` is unset, the call throws, and no token is ever registered.
      Firebase Admin cannot send to an Expo token anyway. Switch to
      `getDevicePushTokenAsync()`.
- [ ] **[BLOCKER] `google-services.json` is not at the repo root.** `app.config.ts` omits
      Firebase silently and only warns.
- [ ] **[BLOCKER] `EXPO_PUBLIC_RORK_API_BASE_URL` defaults to `http://localhost:8080`**
      and is inlined at bundle time. Set it to your HTTPS origin in the shell that runs
      Gradle, and prove it took.
- [ ] Precise location is sent to `https://router.project-osrm.org` (`lib/routing.ts`).
      Remove it, or declare **Shared: Yes** for both location rows.
- [ ] `SUPPORT_EMAIL: 'support@courierapp.com'` / `SUPPORT_PHONE: '+998901234567'` are
      placeholders that `app/verification-pending.tsx` opens.
- [ ] The "Withdraw Funds" FAQ string in all three locales points at a button that does
      not exist.
- [ ] `app.json` still exists beside `app.config.ts` and lists different permissions.
      `app.config.ts` wins (confirmed via `npx expo config --type prebuild --json`), but
      delete `app.json` so nobody audits the wrong file.

---

## Phase 2 — settle the declarations before you build

Read `PLAY_STORE_SUBMISSION.md` §4 (Data safety), §5 (background location), §7
(permissions), §8 (content rating), §9 (target audience, ads, financial features).

Then apply the corrections in §A1–A3 and §B of this file, which the submission pack does
not have.

---

## Phase 3 — publish the web assets

All three are URLs Play fetches or a reviewer opens. All three are outside this repo.

- [ ] **Privacy policy** — `[ACTION REQUIRED: https://…/privacy]`. Must be public, not
      behind a login, must name background location explicitly, must name
      `router.project-osrm.org` if you keep it, and must not contradict the Data safety
      form. Goes into **both** Play Console and `app/onboarding.tsx`.
- [ ] **Account & data deletion page** — `[ACTION REQUIRED: https://…/delete-account]`.
      Draft content is in `PLAY_STORE_SUBMISSION.md` §6.3. Must work without installing
      the app and without logging in.
- [ ] **Background-location demo video** — only if background location stays. Unlisted
      YouTube (not Private — reviewers cannot open Private), verified in an incognito
      window. **Cut it to ≤30 seconds** for the declaration form; see §A5.

---

## Phase 4 — build and verify the AAB

Follow `ANDROID_RELEASE.md` §1–§4 exactly. The short form:

```bash
cd /home/user/elcafe-courier-mobile-app
ls -l google-services.json                 # must exist
export EXPO_PUBLIC_RORK_API_BASE_URL="https://api.your-domain.com"
npm ci
npx expo prebuild --platform android --clean
cd android && ./gradlew :app:bundleRelease && cd ..
./scripts/verify-aab.sh android/app/build/outputs/bundle/release/app-release.aab
```

- [ ] `verify-aab.sh` exits 0. **Expect it to warn about `CAMERA` and
      `RECEIVE_BOOT_COMPLETED` — that warning is a bug in the script's expected list, not
      a problem with your build. See §B1 before you "fix" it by blocking those
      permissions.**
- [ ] Signer is **not** `CN=Android Debug`. The signing plugin falls back to the debug
      keystore silently when the `ZBR_UPLOAD_*` properties are missing; the build still
      succeeds and the artifact is unuploadable.
- [ ] `versionCode` is strictly greater than anything ever uploaded. Bump with
      `node scripts/bump-version.mjs`.
- [ ] Every `.so` LOAD segment aligns to `0x4000` or greater (16 KB pages).

---

## Phase 5 — Play Console

Order matters: create the app, fill App content, then upload.

**Store presence → Main store listing** — copy from `PLAY_STORE_LISTING.md`:
- [ ] App name / short description / full description, en-US + ru-RU + uz
- [ ] `store-assets/play-icon-512.png`, `store-assets/feature-graphic-1024x500.png`
- [ ] 2–8 phone screenshots per locale (aim for 8; **1080×1920**, never 1080×2400 — the
      2× aspect cap rejects it)
- [ ] Contact email (public), phone, website — `[ACTION REQUIRED]`
- [ ] Category **Business**; tags from Play's fixed list

**App content** — answers in `PLAY_STORE_SUBMISSION.md`:
- [ ] Privacy policy URL
- [ ] App access → "Some functionality restricted" + the ready-to-paste block in §3.3
- [ ] Ads → **No**
- [ ] Content rating questionnaire → §8
- [ ] Target audience → **18+ only**
- [ ] News → No · COVID-19 → No · **Government apps → No** · Health → No
- [ ] **Financial features → No** (reasoning in §9.3 — cash-on-delivery is not a
      financial feature; keep that paragraph on file)
- [ ] Data safety → the full §4 table, plus the corrections in §A1
- [ ] Data deletion URL
- [ ] **Advertising ID → No** (see §A2 — not covered in the submission pack)
- [ ] Sensitive app permissions → Location permissions declaration + video (if background
      location stays)
- [ ] Foreground service permissions declaration (if `FOREGROUND_SERVICE_LOCATION`
      survives the merge)

**Not covered anywhere else — do not skip:**
- [ ] **Pricing: Free.** Set at app creation. A free app can never be changed to paid.
- [ ] **Countries / regions.** `[ACTION REQUIRED: decide.]` Nothing in the three documents
      names a distribution country. This is a Tashkent-market workforce app; publishing to
      all countries is the default and is *not* what you want. Set it per track under
      **Test and release → <track> → Countries/regions**. Note that restricting
      distribution does **not** hide the app from reviewers.
- [ ] **US export laws + Play developer program policy declarations** at app creation.
- [ ] Managed publishing on, if you want to control the exact go-live moment.

---

## Phase 6 — tracks and rollout

Internal testing → Closed testing → Production. Detail in `ANDROID_RELEASE.md` §5 and
`PLAY_STORE_SUBMISSION.md` §11 — **note those two disagree on the opening rollout
percentage; see §B3.**

- [ ] Internal testing release installed on real Android 12 / 14 / 16 devices
- [ ] Pre-launch report clean (it also surfaces the 16 KB warning)
- [ ] Closed test: **≥12 testers, ≥14 continuous days** if §0.2 applies; otherwise ≥1 week
      of real shifts
- [ ] Location declaration shows **approved** in App content before you schedule launch
- [ ] Production rollout started staged (5% → 10% → 20% → 50% → 100%, a day at each step)

---

## §A — requirements that appear in none of the three documents

### A1. Native Google SDKs the Data safety answers do not account for

`PLAY_STORE_SUBMISSION.md` §1.3 concludes "no ad/analytics/crash SDK" from a **grep of
`package.json`**. That grep cannot see native Gradle dependencies, and this app has
several. Verified in `node_modules`:

| Native dependency | Pulled in by | Declared in build.gradle |
|---|---|---|
| `com.google.firebase:firebase-messaging:24.0.1` | `expo-notifications` | `node_modules/expo-notifications/android/build.gradle:42` |
| `com.google.android.gms:play-services-maps` | `react-native-maps` | `node_modules/react-native-maps/android/build.gradle:66` |
| `com.google.android.gms:play-services-base` | `react-native-maps` | same file, `:65` |
| `com.google.android.gms:play-services-location:21.0.1` | `react-native-maps` **and** `expo-location` (as `api`) | `react-native-maps/android/build.gradle:67`, `expo-location/android/build.gradle:19` |
| `com.google.maps.android:android-maps-utils:3.8.2` | `react-native-maps` | `react-native-maps/android/build.gradle:68` |

None is an ad, analytics or crash SDK, so the *conclusion* in §1.3 survives — but the
**evidence does not**, and the Data safety form asks about data collected by third-party
SDKs, not by your JS dependencies.

What to do:
- Keep **Device or other IDs → Collected: Yes**. Firebase Cloud Messaging generates and
  transmits an app-instance / registration identifier to Google independently of your
  `POST /api/v1/device-tokens` call.
- Keep **Shared: No** for it. Google is a service provider processing on your behalf,
  which Play's rules treat as collection rather than sharing — but be able to say that
  out loud if asked.
- Do **not** cite the `package.json` grep as your evidence for any "No" answer. Cite the
  merged manifest and the Gradle dependency list instead:
  ```bash
  grep -rhoE "com\.google\.(android\.gms|firebase|maps)[a-zA-Z.:-]*" node_modules/*/android/build.gradle | sort -u
  ```
- Re-run that command whenever a dependency is added. A single new package can put an
  analytics SDK in your build without touching `package.json`'s top level.

### A2. Advertising ID declaration

Separate from the "Does your app contain ads?" question. Play Console asks whether the app
uses the advertising ID; apps targeting API 33+ must declare
`com.google.android.gms.permission.AD_ID` if they do. This app does not — the permission
is absent from the generated manifest and no ad SDK is present. **Answer No**, and confirm
after every dependency bump that `AD_ID` has not appeared in the merged manifest
(`verify-aab.sh` will flag it as unexpected).

### A3. Play Integrity / anti-tamper — what is actually required

Nothing. There is no mandatory integrity or anti-tamper step for a Play submission.
For accuracy, so nobody burns a day on it:

- **Play App Signing** is mandatory for new apps and is enrolled automatically at app
  creation. `ANDROID_RELEASE.md` §2 covers it correctly. That is the only compulsory
  integrity mechanism in the path.
- **Play Integrity API** is opt-in, requires server-side verification you have not built,
  and is not needed for v1. Skip it.
- **Automatic protection** (Play Console → App integrity) re-signs your app with anti-
  tamper checks. Optional, off by default, and it changes the delivered binary — do not
  enable it in the same release you are trying to get through a first review.

### A4. What the three documents *do* already cover (so you do not re-audit them)

Privacy policy URL in both Console and the app · account-deletion web URL · ads
declaration · government apps · financial features · content rating · target audience ·
app category, tags and contact email · pricing (Free, `ANDROID_RELEASE.md` §5.1) ·
target API level with a re-check source · 16 KB page size. All present and, where I
checked them against the code, accurate.

### A5. Does the disclosure copy and the video script meet Google's stated requirements?

**The modal does not exist**, so there is no copy to judge — `components/` has no
disclosure component and `i18n/locales/en.json` has no disclosure strings (only
`your_location` and `location_permission_required`). Anyone told otherwise is describing
an intended state, not this tree. What Google requires of it, when it is written
(<https://support.google.com/googleplay/android-developer/answer/9799150> and
<https://support.google.com/googleplay/android-developer/answer/11150561>, read
2026-08-22):

1. Contains the word **"location"**.
2. States background use in words like **"when the app is closed or not in use"** —
   Google's own example sentence is *"This app collects location data to enable [feature]
   even when the app is closed or not in use."*
3. Names **every** feature that uses background location.
4. Appears **in-app, in a dialog, immediately before the runtime permission prompt** —
   not in the app description, not in the privacy policy, not in terms of service.
5. Offers **at least two options, one of which declines**, and uses plain consent language
   ("Agree", not "Allow access"), at a 13-year-old's reading level.

The draft copy in `PLAY_STORE_SUBMISSION.md` §5.3 satisfies 1–3 and 5. Its buttons are
`Continue` / `Not now`; Google's guidance prefers **`Agree`** for the affirmative option —
change it, it costs nothing.

**The video script is roughly 4× too long.** `PLAY_STORE_SUBMISSION.md` §5.4 specifies
"90–150 seconds" across 10 shots ending at 2:05. Google's guidance for the permissions
declaration is a **short video, 30 seconds or less**, focused on the declared feature.
Produce two cuts:

- **Declaration cut, ≤30 s:** go online → disclosure held on screen ~6 s → system dialog →
  "Allow all the time" → Google Maps on top with the ZBR tracking notification visible.
  That is the whole chain a reviewer must see, and it fits.
- **Long cut (the existing 10 shots):** keep it, but link it from the **App access** notes
  as an orientation video, not from the declaration form.

Everything else in §5.4 is sound — especially "record on a real device, not an emulator"
and "never Private on YouTube".

---

## §B — errata: where the three documents are wrong or disagree

### B1. `verify-aab.sh` and `ANDROID_RELEASE.md` §4.3 will false-alarm on a real AAB

`ANDROID_RELEASE.md` §4.3 prints an 11-permission list as the expected output of
`bundletool dump manifest` (the **merged** manifest), and the §8 appendix sources that
list from `cat android/app/src/main/AndroidManifest.xml` (the **pre-merge** file).
`scripts/verify-aab.sh` bakes the same 11 entries into `EXPECTED_PERMS`.

Library manifests merge at build time and add two more. Verified:

```
node_modules/expo-image-picker/android/src/main/AndroidManifest.xml  -> android.permission.CAMERA
node_modules/expo-notifications/android/src/main/AndroidManifest.xml -> android.permission.RECEIVE_BOOT_COMPLETED
```

Neither is in `android.blockedPermissions`, so both **will** be in the AAB, and
`verify-aab.sh` will report *"permission(s) present that this script did not expect:
CAMERA, RECEIVE_BOOT_COMPLETED"*.

**Fix:** add both to `EXPECTED_PERMS` in `scripts/verify-aab.sh` and to the §4.3 list
(13 permissions, not 11). **Do not "fix" it by blocking them** — `CAMERA` is genuinely
used by `app/report-issue.tsx` and `app/edit-profile.tsx`, and `PLAY_STORE_SUBMISSION.md`
§7.1 already justifies both correctly. Left as-is, the first real run of the gate produces
a warning the operator learns to ignore, which is worse than no gate.

### B2. `PLAY_STORE_LISTING.md`'s `app.config.ts` line citations have drifted

`app.config.ts` was edited after that document was written. Real line numbers today:
`name: 'ZBR Courier'` is **:54** (doc says :47), `package` is **:71** (:64),
`versionCode: 1` is **:74** (:67), `isAndroidBackgroundLocationEnabled` is **:208**
(:201). The values are all still correct; only the anchors are stale. Same class of drift
applies to `components/OrderMap.native.tsx` — `PROVIDER_DEFAULT` is imported at **:3** and
used at **:161**, and the two documents each cite one of those as if it were the other's.
Re-grep rather than trusting a line number.

### B3. The two documents disagree on the opening rollout percentage

`PLAY_STORE_SUBMISSION.md` §11.1 says "start at 10–20%". `ANDROID_RELEASE.md` §5.4 says
start at **5%** and gives a 5/10/20/50/100 ladder. **Use the 5% ladder** — it is the
safer of the two and the one the runbook you will actually have open in front of you
specifies. Fix §11.1 to match.

They also disagree about where the first Google review happens: §11.1 says the location
declaration review starts from internal testing, §5.3 says "this is where the first Google
review happens for a new app" of the **closed** track. Play Console's own **App content**
page shows the declaration's real status per app — treat that as authoritative and ignore
both claims.

### B4. `check_copy.py` enforces an invariant that the recommended path breaks

`store-assets/check_copy.py` **fails non-zero** if the sentence "even when the app is
closed or not in use" (and its ru/uz equivalents) is missing from a full description.
`PLAY_STORE_SUBMISSION.md` §5.1 recommends, as "the fastest route to a first production
release", shipping v1 **without** background location — at which point that sentence
becomes a false claim in the listing and must be deleted, and the gate then fails the
build for doing the right thing.

**Fix:** make the assertion conditional on the shipped config rather than unconditional —
read `android.permissions` out of `npx expo config --type prebuild --json` and require the
sentence **iff** `ACCESS_BACKGROUND_LOCATION` is present, forbid it otherwise. That turns
the check into what it is actually for: keeping the listing and the manifest in agreement
in both directions.

### B5. `PLAY_STORE_LISTING.md` §5.2 says to install "the release AAB/APK"

An AAB cannot be installed on a device. Use the release **APK**
(`./gradlew :app:assembleRelease`) or generate one from the bundle with
`bundletool build-apks --mode=universal`; `ANDROID_RELEASE.md` §3.5 and §4.5 have both.

### B6. `PLAY_STORE_LISTING.md` §6 asks for reviewer "OTP handling"

It requests "demo courier phone number / email + password + **OTP handling** for
reviewers". `PLAY_STORE_SUBMISSION.md` §3.1 establishes — correctly, verified — that
`app/login.tsx` is email + password only and that `/login-otp` is registered but
unreachable from the login UI, so **no OTP is needed and the App access notes should say
so explicitly**. Drop the OTP request from the listing doc's action item.

### B7. ALL-CAPS section headings in the full descriptions

Advisory, not a blocker. The English description contains 33 all-caps words, Russian 24,
Uzbek 30 — all of them section headings (`WORK YOUR OWN SHIFT`, `ЗАКАЗЫ РЯДОМ С ВАМИ`,
`JOYLASHUV`, …). I checked the copy for the things Play's *Store Listing and Promotion*
policy actually rejects and found **none**: zero emoji, zero superlatives, zero "#1"
claims, zero competitor names, no keyword stuffing, no income guarantees, and every field
inside its limit (recounted independently: en 11/77/2525/467, ru 11/64/2403/477,
uz 11/69/2671/472 against limits 30/80/4000/500). Capitalised headings are common and
widely tolerated, but Play's policy does name excessive capitalisation. If you want zero
risk, sentence-case the headings; it costs nothing and reads better.

---

## §C — the date-dependent items, and how to re-check each

Every one of these moves on Google's schedule. **Play Console → Policy → Program updates**
is the only source specific to *your* account and is never stale; the pages below are the
general policy.

| Item | Current answer (read 2026-08-22) | Re-check at |
|---|---|---|
| Target API level | API 36 required for new apps and updates from **31 Aug 2026**; extensions to 1 Nov 2026. This build targets 36. | <https://developer.android.com/google/play/requirements/target-sdk> — and an upload attempt, which names the required level in the error |
| 16 KB page sizes | Required for apps targeting API 35+; non-compliant updates blocked from **1 Feb 2027** | <https://developer.android.com/guide/practices/page-sizes>, plus the pre-launch report warning |
| New personal account testing rule | **12 testers / 14 continuous days** (was 20 until 11 Dec 2024) | <https://support.google.com/googleplay/android-developer/answer/14151465> |
| Background location policy + video | ≤30 s video, in-app disclosure before the prompt | <https://support.google.com/googleplay/android-developer/answer/9799150> |
| Prominent disclosure wording | See §A5 | <https://support.google.com/googleplay/android-developer/answer/11150561> |
| Data safety form | See `PLAY_STORE_SUBMISSION.md` §4 | <https://support.google.com/googleplay/android-developer/answer/10787469> |
| Screenshot / graphic constraints | 2–8 phone shots, 320–3840 px sides, longest ≤2× shortest, no alpha | <https://support.google.com/googleplay/android-developer/answer/9866151> — and the Console uploader, which states the exact numeric reason on rejection |
| Android vitals thresholds | Crash 1.09%, ANR 0.47% overall; 8% per model over 28 days | <https://developer.android.com/topic/performance/vitals> |

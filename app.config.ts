import { existsSync } from "fs";
import { ExpoConfig, ConfigContext } from "expo/config";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveBuildNumber } = require("./scripts/build-number");

/**
 * App config (converted from app.json so build-time secrets can be injected
 * from the environment).
 *
 * Builds are done LOCALLY (npx expo prebuild + Gradle/Xcode) and uploaded
 * to the stores manually — EAS is not used. Set these in the shell (or a
 * .env file, which Expo loads) before prebuild/bundling:
 *   GOOGLE_MAPS_API_KEY   Android Google Maps SDK key (react-native-maps)
 *   GOOGLE_SERVICES_JSON  Optional path override for google-services.json;
 *                         defaults to ./google-services.json (repo root)
 *
 * Release signing is supplied at Gradle time, not here - see
 * plugins/withAndroidReleaseSigning.js for the ZBR_UPLOAD_* properties.
 *
 * See docs/PRODUCTION.md for the full launch checklist.
 */

/**
 * A release bundle without its environment MUST fail here, at build time.
 *
 * constants/config.ts used to throw at module scope when
 * EXPO_PUBLIC_RORK_API_BASE_URL was missing. app/_layout.tsx imports it before
 * anything renders, so that throw became an unhandled JS error during startup,
 * which React Native reports through RCTExceptionsManager.reportFatalException
 * -> ObjC exception -> abort(). The app died ~150ms after launch with a blank
 * screen and App Review rejected it under guideline 2.1(a) as "crashed on
 * launch". The build itself succeeded and gave no warning.
 *
 * This config is evaluated by `expo export:embed`, which is what Xcode's
 * "Bundle React Native code and images" phase and Gradle's bundle task both
 * run. Failing here fails the ARCHIVE, so a build that cannot work can no
 * longer be produced, signed, and uploaded.
 *
 * Gated on NODE_ENV=production so `expo prebuild` and dev bundling — which
 * legitimately run without secrets — are unaffected.
 */
/**
 * android.versionCode and ios.buildNumber, derived from the clock rather than
 * stored — see scripts/build-number.js for why. Computed once here so both
 * platforms in a single evaluation get the same number.
 *
 * To reproduce a specific build, set ZBR_BUILD_NUMBER to the number that build
 * shipped with.
 */
const buildNumber: number = resolveBuildNumber({ override: process.env.ZBR_BUILD_NUMBER });

const REQUIRED_RELEASE_ENV = ["EXPO_PUBLIC_RORK_API_BASE_URL"] as const;
if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_RELEASE_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `[app.config] Cannot build a release bundle: ${missing.join(", ")} is not set.\n` +
      "The app cannot reach the backend without it, and a bundle built this way " +
      "shows a configuration error instead of the app.\n" +
      "Set it in .env (or the shell running the build) and rebuild. " +
      "See docs/PRODUCTION.md section 1."
    );
  }
}

// Firebase config for Android push (FCM). Required for ANY Android push
// delivery — a build without it ships with push notifications dead AND
// getDevicePushTokenAsync throws at runtime. Wired conditionally so dev
// machines without the secret can still evaluate this config.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const hasGoogleServicesFile = existsSync(googleServicesFile);
if (!hasGoogleServicesFile) {
  // Config evaluation runs in Node (not the app bundle) — console is correct here.
  console.warn(
    `[app.config] ${googleServicesFile} not found — Android push notifications ` +
    "will NOT work in this build. See docs/PRODUCTION.md section 3."
  );
}
// Android Google Maps SDK key. react-native-maps renders blank grey tiles with
// no visible error when this is missing, so warn loudly rather than shipping a
// map-less courier app. Deliberately NOT fatal: dev machines without the key
// must still be able to prebuild and run everything except the map.
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
// lib/crashReporting.ts is a no-op unless this is set, so the iOS privacy
// manifest below declares crash collection only when the build actually does it.
const collectsCrashData = !!process.env.EXPO_PUBLIC_CRASH_ENDPOINT;
if (!googleMapsApiKey) {
  console.warn(
    "[app.config] GOOGLE_MAPS_API_KEY is not set — com.google.android.geo.API_KEY " +
    "will be omitted from AndroidManifest.xml and every map will render as blank " +
    "grey tiles. Do NOT upload this build. See docs/PRODUCTION.md."
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ZBR Courier",
  slug: "zbr-courier",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "zbr-courier",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "cover",
    backgroundColor: "#059669",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.zbr.courier",
    buildNumber: String(buildNumber),
    // Backend sends iOS push directly via APNs — pin the production APNs
    // environment for store builds (Xcode flips debug builds automatically).
    entitlements: {
      "aps-environment": "production",
    },
    // Apple has required a privacy manifest since May 2024. Without it App
    // Store Connect flags the upload, and any "required reason API" used by the
    // app or its SDKs must be declared with an approved reason code.
    //
    // NSPrivacyTracking is false: this app has no ad or analytics SDK and never
    // links data to third-party data for advertising, so no App Tracking
    // Transparency prompt is required either.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          // Foreground ("while in use") location only — no background tracking
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          // deviceId/deviceName sent to POST /device-tokens for push routing
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        ...(collectsCrashData
          ? [
              {
                NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData",
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
              },
            ]
          : []),
      ],
      NSPrivacyAccessedAPITypes: [
        {
          // expo-file-system / React Native asset handling
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          // AsyncStorage and Expo modules reading app-owned defaults
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          // React Native / Hermes timing
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          // expo-file-system writing to app storage
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
    infoPlist: {
      // App uses HTTPS only (exempt encryption) — declaring it here skips the
      // export-compliance questionnaire on every App Store Connect upload.
      ITSAppUsesNonExemptEncryption: false,
      // While-in-use only. The Always variants are deliberately absent: asking
      // for Always is what puts an app in front of Apple's background-location
      // scrutiny, and this build does not track in the background at all.
      NSLocationWhenInUseUsageDescription:
        "ZBR Courier uses your location while the app is open to show your position on the delivery map, calculate routes to pickup and drop-off points, and share your live position with dispatch and the customer while you are viewing an active delivery.",
      NSUserNotificationsUsageDescription:
        "ZBR Courier sends you notifications about new order assignments, order status changes, and messages from dispatch so you never miss a delivery.",
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze", "maps"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#059669",
    },
    ...(hasGoogleServicesFile ? { googleServicesFile } : {}),
    package: "app.zbr.courier",
    versionCode: buildNumber,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
    // Foreground ("while in use") location only. ACCESS_BACKGROUND_LOCATION
    // and the FOREGROUND_SERVICE_* permissions were deliberately dropped: each
    // one triggers a Play Console policy declaration requiring a demo video and
    // a manual human review, and the product decision was to ship without them.
    // Consequence: the courier's position stops updating whenever the app is
    // not on screen — including while they are navigating in Google Maps.
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "android.permission.VIBRATE",
    ],
    // Emits tools:node="remove" so the Gradle manifest merger strips these even
    // though a dependency's own AndroidManifest.xml declares them. Everything
    // here is unreachable in this app; shipping any of it invites a Play policy
    // review we cannot answer.
    blockedPermissions: [
      // Belt and braces for the declaration-triggering permissions: expo-location
      // and its config plugin can still inject these from their own manifests,
      // and a single one reaching the merged manifest re-opens the Play
      // declaration that this build exists to avoid.
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      // expo-audio declares RECORD_AUDIO in its library manifest
      // (node_modules/expo-audio/android/src/main/AndroidManifest.xml). This app
      // only PLAYS the bundled new-order alert - it never records. The plugin is
      // also configured with recordAudioAndroid:false below; this blocks the
      // library-manifest copy that the plugin option cannot reach.
      "android.permission.RECORD_AUDIO",
      // expo-audio also declares FOREGROUND_SERVICE_MEDIA_PLAYBACK for its
      // AudioControlsService (lock-screen transport controls). That service is
      // only ever started by AudioPlayer.setActiveForLockScreen(), which this
      // app never calls - see plugins/withAndroidNoUnusedAudioServices.js.
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      // The Expo bare template ships this in its "OPTIONAL PERMISSIONS, REMOVE
      // WHATEVER YOU DO NOT NEED" block. Nothing in this app draws over other
      // apps; leaving it in makes Play list "Display over other apps" against a
      // delivery app for no reason. Note: React Native's debug-only source set
      // (react-native/ReactAndroid/src/debug/AndroidManifest.xml) also declares
      // it for the perf-monitor overlay, and tools:node="remove" applies to all
      // build types - so the RN debug overlay is disabled in dev builds too.
      // Delete this one line if you need that overlay back.
      "android.permission.SYSTEM_ALERT_WINDOW",
      // expo-file-system declares both (plugin/build/withFileSystem.js and its
      // library manifest). It is a hard dependency of `expo` itself and offers
      // no opt-out, but nothing in this app touches the filesystem - the only
      // transitive consumer is expo-asset, which reads assets bundled in the APK
      // and writes to the app-private cache dir, neither of which needs a
      // permission. WRITE_EXTERNAL_STORAGE is ignored from API 29 and
      // READ_EXTERNAL_STORAGE from API 33 anyway (targetSdk is 36), so these
      // only serve to make Play list file/media access on a delivery app.
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
  },
  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
    output: "single",
    name: "ZBR Courier",
  },
  plugins: [
    // `origin` was left pointing at the third-party scaffold domain
    // (https://rork.com/) that generated this project. It seeds expo-router's
    // base URL for static rendering / API routes, so shipping someone else's
    // domain in a production build is wrong. This app is client-only with a
    // separate Spring backend, so it needs no origin at all.
    ["expo-router", { origin: false }],
    "expo-font",
    "expo-web-browser",
    "expo-localization",
    [
      // The app stores tokens in the keychain but never uses biometrics. Left
      // to itself the plugin writes NSFaceIDUsageDescription with Expo's
      // placeholder text, so the reviewed build declared a Face ID purpose for
      // a capability it does not have.
      "expo-secure-store",
      { faceIDPermission: false },
    ],
    [
      "expo-location",
      {
        // All three OFF — see the android.permissions note above.
        isAndroidForegroundServiceEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
        locationWhenInUsePermission:
          "ZBR Courier uses your location while the app is open to show your position on the delivery map, calculate routes, and share your live position with dispatch during an active delivery.",
        // false DELETES the key from Info.plist (@expo/config-plugins
        // ios/Permissions.js treats false as a removal). Without this the
        // plugin writes NSLocationAlwaysAndWhenInUseUsageDescription and
        // NSLocationAlwaysUsageDescription even with background location off —
        // the first carried our old text promising background tracking, and the
        // second Expo's placeholder "Allow $(PRODUCT_NAME) to access your
        // location". Both were still in the reviewed build: an Info.plist
        // advertising background location for an app that has none, which
        // contradicts the privacy manifest and invites exactly the scrutiny
        // removing background location was meant to avoid.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
      },
    ],
    [
      "expo-notifications",
      {
        // 96x96 all-white-with-transparency PNG. Without this Android draws the
        // full-colour launcher icon squashed into the status bar as a grey blob.
        icon: "./assets/images/notification-icon.png",
        color: "#059669",
        // Fallback channel for any FCM message that does not name one. The
        // backend targets `orders_v2` explicitly, but if it ever omits the
        // field the push should still land on the order channel rather than a
        // quieter generic one. Keep in step with
        // ORDER_CONFIG.ANDROID_ORDER_CHANNEL_ID.
        defaultChannel: "orders_v2",
      },
    ],
    [
      // Playback only (services/soundService.ts). Both options below stop the
      // plugin adding microphone permissions; the copies in expo-audio's own
      // library manifest are stripped by android.blockedPermissions above.
      "expo-audio",
      {
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        resizeMode: "cover",
        backgroundColor: "#059669",
      },
    ],
    // Local plugins. android/ is generated by `expo prebuild` and is not
    // committed, so anything that has to be true of the native project must be
    // re-applied on every prebuild from here.
    //
    // Signs release builds with the ZBR_UPLOAD_* keystore instead of the debug
    // keystore the bare template wires up. Play auto-rejects debug-signed AABs.
    "./plugins/withAndroidReleaseSigning",
    // Removes expo-audio's AudioRecordingService (foregroundServiceType
    // "microphone") and AudioControlsService (mediaPlayback) - neither is
    // reachable from this app's playback-only usage.
    "./plugins/withAndroidNoUnusedAudioServices",
  ],
  experiments: {
    typedRoutes: true,
  },
});

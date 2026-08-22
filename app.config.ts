import { existsSync } from "fs";
import { ExpoConfig, ConfigContext } from "expo/config";

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
    buildNumber: "1",
    // Backend sends iOS push directly via APNs — pin the production APNs
    // environment for store builds (Xcode flips debug builds automatically).
    entitlements: {
      "aps-environment": "production",
    },
    infoPlist: {
      // App uses HTTPS only (exempt encryption) — declaring it here skips the
      // export-compliance questionnaire on every App Store Connect upload.
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "ZBR Courier uses your location while the app is open to show your position on the delivery map, calculate routes to pickup and drop-off points, and share your live position with dispatch and the customer during an active delivery.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "While you are on shift with an active delivery, ZBR Courier tracks your location in the background so dispatch and the customer can follow the delivery in real time and so you receive orders near you. Tracking stops when you go off shift.",
      NSLocationAlwaysUsageDescription:
        "While you are on shift with an active delivery, ZBR Courier tracks your location in the background so dispatch and the customer can follow the delivery in real time. Tracking stops when you go off shift.",
      NSUserNotificationsUsageDescription:
        "ZBR Courier sends you notifications about new order assignments, order status changes, and messages from dispatch so you never miss a delivery.",
      UIBackgroundModes: ["location"],
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
    versionCode: 1,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "android.permission.VIBRATE",
    ],
    // Emits tools:node="remove" so the Gradle manifest merger strips these even
    // though a dependency's own AndroidManifest.xml declares them. Everything
    // here is unreachable in this app; shipping any of it invites a Play policy
    // review we cannot answer.
    blockedPermissions: [
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
      "expo-location",
      {
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
        locationWhenInUsePermission:
          "ZBR Courier uses your location while the app is open to show your position on the delivery map, calculate routes, and share your live position with dispatch during an active delivery.",
        locationAlwaysAndWhenInUsePermission:
          "While you are on shift with an active delivery, ZBR Courier tracks your location in the background so dispatch and the customer can follow the delivery in real time. Tracking stops when you go off shift.",
      },
    ],
    [
      "expo-notifications",
      {
        // 96x96 all-white-with-transparency PNG. Without this Android draws the
        // full-colour launcher icon squashed into the status bar as a grey blob.
        icon: "./assets/images/notification-icon.png",
        color: "#059669",
        defaultChannel: "default",
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

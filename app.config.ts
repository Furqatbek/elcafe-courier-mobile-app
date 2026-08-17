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
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
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
  },
  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
    output: "single",
    name: "ZBR Courier",
  },
  plugins: [
    [
      "expo-router",
      {
        origin: "https://rork.com/",
      },
    ],
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
        color: "#059669",
        defaultChannel: "default",
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
  ],
  experiments: {
    typedRoutes: true,
  },
});

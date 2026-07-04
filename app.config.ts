import { existsSync } from "fs";
import { ExpoConfig, ConfigContext } from "expo/config";

/**
 * App config (converted from app.json so build-time secrets can be injected
 * from the environment / EAS secrets).
 *
 * Build-time env vars (NOT EXPO_PUBLIC_* — these are consumed here at config
 * evaluation time, set them as EAS secrets or in the shell running the build):
 *   GOOGLE_MAPS_API_KEY   Android Google Maps SDK key (react-native-maps)
 *   EAS_PROJECT_ID        EAS project UUID (expo.dev project settings)
 *   GOOGLE_SERVICES_JSON  Optional path to google-services.json (EAS file
 *                         secret); defaults to ./google-services.json
 *
 * See docs/PRODUCTION.md for the full launch checklist.
 */

// Firebase config for Android push (FCM). Required for ANY Android push
// delivery — a build without it ships with push notifications dead.
// Wired conditionally so local dev machines without the secret can still
// evaluate this config; EAS builds provide it via a file secret
// (GOOGLE_SERVICES_JSON) or a committed google-services.json.
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
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});

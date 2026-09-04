/**
 * Push Notification Service
 * Handles FCM token registration/unregistration with the backend
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { BASE_URL, API_ENDPOINTS, APP_CONFIG } from '@/constants/config';
import tokenManager from '@/services/tokenManager';
import logger from '@/lib/logger';

const DEVICE_TOKEN_KEY = 'fcm_device_token';
// Stable per-install identifier. The backend keys device tokens by deviceId, so
// this must survive app restarts (but not reinstalls — a reinstall gets a new
// FCM token anyway).
const DEVICE_ID_KEY = 'device_install_id';

export type DeviceType = 'IOS' | 'ANDROID' | 'WEB';

/**
 * Body of POST /api/v1/device-tokens, exactly as the backend expects.
 * Note the field names: `token`/`platform`, NOT `deviceToken`/`deviceType`.
 */
export interface DeviceTokenRequest {
  token: string;
  platform: DeviceType;
  deviceId: string;
  deviceName: string;
  appId: string;
  appVersion: string;
}

/** Random enough for a device identifier; not security-sensitive. */
function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

function getDeviceName(): string {
  const parts = [Device.manufacturer, Device.modelName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : `${Platform.OS} device`;
}

/**
 * Typed result so callers can distinguish "user denied permission" from
 * an actual token-acquisition failure.
 */
export type PushTokenResult =
  | { status: 'success'; token: string }
  | { status: 'unsupported' }         // web or non-physical device
  | { status: 'permission-denied' }
  | { status: 'error'; error: unknown };

/**
 * Get the device type based on platform
 */
function getDeviceType(): DeviceType {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

/**
 * Request notification permissions and get the NATIVE device push token.
 *
 * The backend sends via Firebase Admin (Android) and directly via APNs
 * (iOS) using its own platform keys — it does NOT use the Expo push
 * service, and it rejects/deactivates ExponentPushToken[...] formats.
 * getDevicePushTokenAsync returns exactly what the backend needs:
 *   Android → the FCM registration token (requires google-services.json
 *             baked into the build; the call throws without it)
 *   iOS     → the raw APNs device token
 * The backend routes on the deviceType field we send alongside.
 */
export async function getPushTokenResult(): Promise<PushTokenResult> {
  // Skip on web or non-physical devices
  if (Platform.OS === 'web') {
    logger.log('Push notifications not supported on web');
    return { status: 'unsupported' };
  }

  if (!Device.isDevice) {
    logger.log('Push notifications require a physical device');
    return { status: 'unsupported' };
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.log('Push notification permission denied');
      return { status: 'permission-denied' };
    }

    // Native token: FCM registration token on Android (throws when the build
    // is missing google-services.json — surfaced as 'error' below, loudly),
    // raw APNs device token on iOS. No Expo push service involved.
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = typeof tokenData.data === 'string' ? tokenData.data : JSON.stringify(tokenData.data);

    return { status: 'success', token };
  } catch (error) {
    logger.error('Failed to get native device push token (Android: is google-services.json baked into this build?):', error);
    return { status: 'error', error };
  }
}

/**
 * Legacy convenience wrapper: resolves to the token string or null.
 * Prefer getPushTokenResult() when the failure reason matters.
 */
export async function getPushToken(): Promise<string | null> {
  const result = await getPushTokenResult();
  return result.status === 'success' ? result.token : null;
}

// Preference key written by the Settings notifications toggle. Checked here
// centrally so login/session-restore registration also honors an explicit
// opt-out — otherwise the toggle would be silently undone on every restart.
const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';

export async function isNotificationsPreferenceEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)) !== 'false';
  } catch {
    return true;
  }
}

/**
 * The passed access token may be stale (e.g. a session restore after days
 * offline hands us the token that was persisted before the app was killed).
 * Prefer a validated/refreshed token from the token manager and only fall
 * back to the caller's token when the manager has none.
 */
async function resolveAuthToken(accessToken: string): Promise<string> {
  try {
    return (await tokenManager.getValidAccessToken()) ?? accessToken;
  } catch {
    return accessToken;
  }
}

/**
 * Register device token with the backend
 */
export async function registerDeviceToken(accessToken: string): Promise<boolean> {
  try {
    if (!(await isNotificationsPreferenceEnabled())) {
      logger.log('[pushNotification] Skipping device token registration: notifications disabled in settings');
      return false;
    }
    const tokenResult = await getPushTokenResult();

    if (tokenResult.status !== 'success') {
      switch (tokenResult.status) {
        case 'permission-denied':
          logger.log('[pushNotification] Skipping device token registration: notification permission denied');
          break;
        case 'unsupported':
          logger.log('[pushNotification] Skipping device token registration: unsupported platform/device');
          break;
        default:
          logger.error('[pushNotification] Skipping device token registration: failed to obtain native push token');
      }
      return false;
    }

    const pushToken = tokenResult.token;

    const payload: DeviceTokenRequest = {
      token: pushToken,
      platform: getDeviceType(),
      deviceId: await getDeviceId(),
      deviceName: getDeviceName(),
      // Real applicationId of this build rather than a hard-coded string, so
      // the backend never sees a value that disagrees with the installed app.
      appId: Application.applicationId ?? 'app.zbr.courier',
      appVersion: APP_CONFIG.VERSION,
    };

    const authToken = await resolveAuthToken(accessToken);

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.DEVICE_TOKENS.REGISTER}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Store the token locally for cleanup on logout
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, pushToken);
      logger.log('Device token registered successfully');
      return true;
    }

    logger.error('Failed to register device token:', response.status);
    return false;
  } catch (error) {
    logger.error('Error registering device token:', error);
    return false;
  }
}

/**
 * Unregister all device tokens from the backend (call on logout)
 * This removes all tokens for this user, ensuring clean logout
 */
export async function unregisterDeviceToken(accessToken: string): Promise<boolean> {
  try {
    const authToken = await resolveAuthToken(accessToken);

    // The backend needs to know WHICH token to remove, and the field is named
    // `deviceToken` here even though registering sends it as `token`. That
    // asymmetry is real: sending nothing (as this did) or sending `token` is a
    // silent no-op, and the phone keeps receiving push after logout.
    const storedToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.DEVICE_TOKENS.UNREGISTER}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      ...(storedToken ? { body: JSON.stringify({ deviceToken: storedToken }) } : {}),
    });

    // Clear local storage regardless of API response
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);

    if (response.ok) {
      logger.log('All device tokens unregistered successfully');
      return true;
    }

    logger.error('Failed to unregister device tokens:', response.status);
    return false;
  } catch (error) {
    logger.error('Error unregistering device tokens:', error);
    // Still clear local storage on error
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
    return false;
  }
}

/**
 * Setup notification handlers
 */
export function setupNotificationHandlers() {
  // Configure how notifications appear when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Add listener for received notifications
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification responses (user tapped notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export default {
  getPushToken,
  getPushTokenResult,
  registerDeviceToken,
  unregisterDeviceToken,
  setupNotificationHandlers,
  addNotificationReceivedListener,
  addNotificationResponseListener,
};

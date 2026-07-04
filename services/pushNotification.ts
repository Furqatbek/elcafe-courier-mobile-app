/**
 * Push Notification Service
 * Handles FCM token registration/unregistration with the backend
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, APP_CONFIG } from '@/constants/config';
import tokenManager from '@/services/tokenManager';
import logger from '@/lib/logger';

const DEVICE_TOKEN_KEY = 'fcm_device_token';

export type DeviceType = 'IOS' | 'ANDROID' | 'WEB';

export interface DeviceTokenRequest {
  deviceToken: string;
  deviceType: DeviceType;
  appVersion: string;
}

/**
 * Typed result so callers can distinguish "user denied permission" from
 * "this build is misconfigured (no EAS projectId)".
 */
export type PushTokenResult =
  | { status: 'success'; token: string }
  | { status: 'unsupported' }         // web or non-physical device
  | { status: 'permission-denied' }
  | { status: 'misconfigured' }       // no EAS projectId in this build
  | { status: 'error'; error: unknown };

/**
 * Get the device type based on platform
 */
function getDeviceType(): DeviceType {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

let warnedMissingProjectId = false;

/**
 * Resolve the EAS projectId for this build. Required by
 * Notifications.getExpoPushTokenAsync in production builds.
 */
function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_PROJECT_ID;
}

/**
 * Request notification permissions and get push token.
 * Returns a typed result so callers can distinguish "no permission"
 * from "misconfigured build".
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

    // The projectId is mandatory for push tokens in standalone builds — a
    // missing one means push is silently dead in production, so fail loudly.
    const projectId = getProjectId();
    if (!projectId) {
      if (!warnedMissingProjectId) {
        warnedMissingProjectId = true;
        logger.warn(
          '[pushNotification] No EAS projectId found (expoConfig.extra.eas.projectId ' +
          'or EXPO_PUBLIC_PROJECT_ID). Push notifications are DISABLED in this build. ' +
          'Configure the projectId in app config / env to enable push.'
        );
      }
      return { status: 'misconfigured' };
    }

    // Get the push token (FCM on Android, APNs on iOS)
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    return { status: 'success', token: tokenData.data };
  } catch (error) {
    logger.error('Failed to get push token:', error);
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
        case 'misconfigured':
          logger.warn('[pushNotification] Skipping device token registration: build is missing an EAS projectId');
          break;
        case 'permission-denied':
          logger.log('[pushNotification] Skipping device token registration: notification permission denied');
          break;
        case 'unsupported':
          logger.log('[pushNotification] Skipping device token registration: unsupported platform/device');
          break;
        default:
          logger.error('[pushNotification] Skipping device token registration: failed to obtain push token');
      }
      return false;
    }

    const pushToken = tokenResult.token;

    const payload: DeviceTokenRequest = {
      deviceToken: pushToken,
      deviceType: getDeviceType(),
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

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.DEVICE_TOKENS.UNREGISTER_ALL}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
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

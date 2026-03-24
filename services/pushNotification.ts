/**
 * Push Notification Service
 * Handles FCM token registration/unregistration with the backend
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, APP_CONFIG } from '@/constants/config';

const DEVICE_TOKEN_KEY = 'fcm_device_token';

export type DeviceType = 'IOS' | 'ANDROID' | 'WEB';

export interface DeviceTokenRequest {
  deviceToken: string;
  deviceType: DeviceType;
  appVersion: string;
}

/**
 * Get the device type based on platform
 */
function getDeviceType(): DeviceType {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

/**
 * Request notification permissions and get push token
 */
export async function getPushToken(): Promise<string | null> {
  // Skip on web or non-physical devices
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
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
      console.log('Push notification permission denied');
      return null;
    }

    // Get the push token (FCM on Android, APNs on iOS)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Register device token with the backend
 */
export async function registerDeviceToken(accessToken: string): Promise<boolean> {
  try {
    const pushToken = await getPushToken();

    if (!pushToken) {
      console.log('No push token available to register');
      return false;
    }

    const payload: DeviceTokenRequest = {
      deviceToken: pushToken,
      deviceType: getDeviceType(),
      appVersion: APP_CONFIG.VERSION,
    };

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.DEVICE_TOKENS.REGISTER}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Store the token locally for cleanup on logout
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, pushToken);
      console.log('Device token registered successfully');
      return true;
    }

    console.error('Failed to register device token:', response.status);
    return false;
  } catch (error) {
    console.error('Error registering device token:', error);
    return false;
  }
}

/**
 * Unregister all device tokens from the backend (call on logout)
 * This removes all tokens for this user, ensuring clean logout
 */
export async function unregisterDeviceToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.DEVICE_TOKENS.UNREGISTER_ALL}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    // Clear local storage regardless of API response
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);

    if (response.ok) {
      console.log('All device tokens unregistered successfully');
      return true;
    }

    console.error('Failed to unregister device tokens:', response.status);
    return false;
  } catch (error) {
    console.error('Error unregistering device tokens:', error);
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
  registerDeviceToken,
  unregisterDeviceToken,
  setupNotificationHandlers,
  addNotificationReceivedListener,
  addNotificationResponseListener,
};

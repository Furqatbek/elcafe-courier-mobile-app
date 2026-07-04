/**
 * Background location tracking.
 *
 * Keeps an on-shift courier's position flowing to the backend while the app
 * is backgrounded — the app itself sends couriers to external navigation apps
 * mid-delivery, backgrounding itself in the process.
 *
 * The task callback runs OUTSIDE React (the JS context may have been revived
 * headlessly), so it must not touch React state or contexts: it reads the
 * access token straight from secure storage and PUTs the fix itself.
 * Failures are swallowed — the next fix retries.
 *
 * IMPORTANT: this module must be imported at app startup (CourierContext
 * imports it) so TaskManager.defineTask runs at module scope before the OS
 * delivers any location events.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG, LOCATION_CONFIG } from '@/constants/config';
import { tokenStorage } from '@/services/api';
import { warn } from '@/lib/logger';

export const BACKGROUND_LOCATION_TASK = 'courier-location-task';

const isNative = Platform.OS !== 'web';

if (isNative) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        warn('[BackgroundLocation] Task error:', error.message);
        return;
      }
      const locations = data?.locations;
      if (!locations || locations.length === 0) {
        return;
      }
      // Only the latest fix matters — the backend keeps current position only
      const latest = locations[locations.length - 1];
      try {
        const token = await tokenStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
        if (!token) {
          // Logged out / session cleared — nothing to report
          return;
        }
        await fetch(`${BASE_URL}${API_ENDPOINTS.COURIER.UPDATE_LOCATION}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
            accuracy: latest.coords.accuracy ?? null,
            heading: latest.coords.heading ?? null,
            speed: latest.coords.speed ?? null,
          }),
        });
      } catch {
        // Swallow transient network/auth failures — the next fix retries
      }
    }
  );
}

/**
 * Start OS-level background location updates for the courier task.
 *
 * No-op when: running on web, background permission is not granted, or
 * updates are already running. Callers are expected to have requested
 * background permission first (CourierContext.startLocationTracking does).
 */
export async function startBackgroundLocationUpdates(): Promise<void> {
  if (!isNative) {
    return;
  }

  const { status } = await Location.getBackgroundPermissionsAsync();
  if (status !== 'granted') {
    warn('[BackgroundLocation] Background permission not granted — skipping background updates');
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_CONFIG.BACKGROUND_INTERVAL,
    distanceInterval: LOCATION_CONFIG.DISTANCE_FILTER,
    // iOS: batch fixes into at most one delivery per background interval
    deferredUpdatesInterval: LOCATION_CONFIG.BACKGROUND_INTERVAL,
    showsBackgroundLocationIndicator: true,
    // Android: a foreground service (with a persistent notification) is what
    // keeps the process alive for location in the background. Plain strings
    // on purpose — the notification is rendered by the OS outside any
    // React/i18n context.
    foregroundService: {
      notificationTitle: 'ZBR Courier is on shift',
      notificationBody: 'Sharing your location with dispatch while you are on shift.',
      notificationColor: '#059669',
    },
  });
}

/**
 * Stop background location updates if they are running. Safe to call
 * unconditionally (web, never-started, already-stopped are all no-ops).
 */
export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (!isNative) {
    return;
  }
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    // hasStartedLocationUpdatesAsync can throw when the task was never
    // registered — nothing to stop in that case
    warn('[BackgroundLocation] Failed to stop background updates:', error);
  }
}

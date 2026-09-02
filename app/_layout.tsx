import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from 'expo-notifications';
import { ORDER_CONFIG } from '@/constants/config';
import { CourierProvider, useCourier } from "@/context/CourierContext";

import { ToastProvider, useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";
import { initCrashReporting, reportCrash } from "@/lib/crashReporting";

import "@/i18n";
import logger from '@/lib/logger';

// Install global crash handlers before the first render so early errors
// are captured too. Idempotent — safe across fast refresh.
initCrashReporting();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Auth navigation handler component
function AuthNavigator({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSessionLoading, courierProfile } = useCourier();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready and session to be loaded
    if (!navigationState?.key || isSessionLoading) return;

    const authScreens = ['login', 'login-otp', 'register', 'become-courier', 'forgot-password', 'onboarding'];
    const inAuthGroup = authScreens.includes(segments[0] as string);
    const inVerificationScreen = segments[0] === 'verification-pending';

    if (isAuthenticated) {
      // Check if courier needs verification
      // API returns 'verified' boolean, also support legacy 'verificationStatus' string
      const isVerified = courierProfile?.verified === true ||
        courierProfile?.verificationStatus === 'approved';
      const needsVerification = courierProfile && !isVerified;

      if (needsVerification && !inVerificationScreen) {
        // Redirect to verification pending screen
        router.replace('/verification-pending');
      } else if (!needsVerification && (inAuthGroup || inVerificationScreen)) {
        // User is verified, redirect to main app
        router.replace('/(tabs)/orders');
      }
    } else if (!isAuthenticated && !inAuthGroup && segments[0] !== undefined) {
      // User is not logged in and not on auth screen, redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, isSessionLoading, segments, navigationState?.key, courierProfile]);

  // Show loading screen while checking session
  if (isSessionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Logo size={120} />
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{
      headerBackTitle: "Back",
      headerTintColor: Colors.primary,
      contentStyle: { backgroundColor: Colors.background }
    }}>
      {/* Auth Screens */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="login-otp" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="become-courier" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="verification-pending" options={{ headerShown: false }} />

      {/* Main App */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Order Screens */}
      <Stack.Screen name="order/[id]" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="order-rating/[orderId]" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="available-orders" options={{ headerShown: true, title: 'Available Orders' }} />
      <Stack.Screen name="report-issue" options={{ headerShown: true, title: 'Report Issue', presentation: 'modal' }} />

      {/* Other Screens */}
      <Stack.Screen name="notifications" options={{ headerShown: true }} />
      <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="personal-info" options={{ headerShown: true }} />
      <Stack.Screen name="vehicle-info" options={{ headerShown: true }} />
      <Stack.Screen name="language" options={{ headerShown: false }} />
      <Stack.Screen name="help-center" options={{ headerShown: false }} />
      <Stack.Screen name="security" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="edit-vehicle" options={{ headerShown: false }} />
      <Stack.Screen name="reviews" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ title: "Oops" }} />
    </Stack>
  );
}


// Configure notification handler - called for each notification when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set up Android notification channel
async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#059669',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
    });

    // New-order channel. The id MUST match what the backend sends
    // (ORDER_CONFIG.ANDROID_ORDER_CHANNEL_ID) or Android drops the push:
    // a notification addressed to a channel that does not exist is not shown.
    // Channel importance is fixed at creation, so a change of importance
    // requires a NEW channel id and a matching backend change.
    await Notifications.setNotificationChannelAsync(ORDER_CONFIG.ANDROID_ORDER_CHANNEL_ID, {
      name: 'New Orders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 200, 500],
      sound: 'default',
      lightColor: '#059669',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
    });

    // Retire the pre-v2 channel so couriers are not left with a dead
    // "New Orders" entry in system settings that no longer receives anything.
    await Notifications.deleteNotificationChannelAsync('orders').catch(() => {});
  }
}

// Push notification types from backend
const PUSH_TYPES = {
  NEW_DELIVERY_AVAILABLE: 'NEW_DELIVERY_AVAILABLE',
} as const;

// Screens where a buffered notification tap must NOT be flushed yet: either
// the user is mid-auth (AuthNavigator is about to router.replace and would
// wipe our push) or still on the index redirect screen.
const NON_NAVIGABLE_SEGMENTS = [
  'login', 'login-otp', 'register', 'become-courier',
  'forgot-password', 'onboarding', 'verification-pending',
];

// Component to handle notification events (native only)
function NotificationHandler() {
  const router = useRouter();
  const toast = useToast();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const {
    fetchNotifications,
    fetchUnreadCount,
    handleNewOrderPush,
    isOnline,
    isAuthenticated,
    isSessionLoading,
  } = useCourier();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // Cold-start taps must be processed exactly once, even though the effect
  // re-runs when its dependencies (e.g. isOnline) change
  const hasHandledColdStartResponse = useRef(false);

  // Notification tap that arrived before the app could navigate (cold start,
  // session still restoring, auth redirect in flight). Held here and flushed
  // once the router is ready AND the session is loaded AND the user is
  // authenticated and inside the main app.
  const pendingRouteRef = useRef<Href | null>(null);

  // Navigating is safe only when the router is mounted, the session finished
  // loading, the user is authenticated, and AuthNavigator has settled them in
  // the main app (pushing while it is about to router.replace would either
  // throw or get wiped by the redirect).
  const canNavigateNow =
    !!navigationState?.key &&
    !isSessionLoading &&
    isAuthenticated &&
    segments[0] !== undefined &&
    !NON_NAVIGABLE_SEGMENTS.includes(segments[0] as string);
  // Session resolved to logged-out: the tap target is stale — drop it rather
  // than surprise-navigate after a later login.
  const shouldDropPending = !!navigationState?.key && !isSessionLoading && !isAuthenticated;

  // Mirror the gate into a ref so listener callbacks always read the latest
  // value without having to re-register on every auth/navigation change.
  const navGateRef = useRef({ canNavigate: false, drop: false });
  navGateRef.current = { canNavigate: canNavigateNow, drop: shouldDropPending };

  const navigateWhenReady = useCallback((route: Href) => {
    const { canNavigate, drop } = navGateRef.current;
    if (canNavigate) {
      router.push(route);
    } else if (drop) {
      logger.log('[Notification] Ignoring notification tap — user not authenticated');
    } else {
      // Buffer until the flush effect below sees the app become ready
      logger.log('[Notification] App not ready to navigate — buffering notification tap');
      pendingRouteRef.current = route;
    }
  }, [router]);

  // Flush (or drop) a buffered notification tap once the gate state changes
  useEffect(() => {
    if (pendingRouteRef.current === null) return;
    if (canNavigateNow) {
      const route = pendingRouteRef.current;
      pendingRouteRef.current = null;
      logger.log('[Notification] Flushing buffered notification navigation');
      router.push(route);
    } else if (shouldDropPending) {
      pendingRouteRef.current = null;
      logger.log('[Notification] Dropping buffered notification navigation — user not authenticated');
    }
  }, [canNavigateNow, shouldDropPending, router]);

  useEffect(() => {
    // Skip notification listeners on web - not fully supported
    if (Platform.OS === 'web') return;

    // Shared handler for notification taps — used for live responses and the
    // cold-start response (app launched by tapping a notification)
    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const notificationType = data?.type as string | undefined;
      // Log type/orderId only — the full response contains customer-facing content
      logger.log('[Notification] User tapped:', { type: notificationType, orderId: data?.orderId });

      // Handle NEW_DELIVERY_AVAILABLE tap - navigate to available order
      if (notificationType === PUSH_TYPES.NEW_DELIVERY_AVAILABLE && data?.orderId) {
        logger.log('[Notification] Navigating to available order:', data.orderId);
        navigateWhenReady(`/available-order/${data.orderId}`);
        return;
      }

      // Navigate based on notification data
      if (data?.orderId) {
        navigateWhenReady(`/order/${data.orderId}`);
      } else if (data?.actionUrl) {
        // Handle actionUrl like /orders/27
        const match = String(data.actionUrl).match(/\/orders\/(\d+)/);
        if (match) {
          navigateWhenReady(`/order/${match[1]}`);
        }
      } else {
        // Default: go to notifications screen
        navigateWhenReady('/notifications');
      }
    };

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const notificationType = data?.type as string | undefined;
      // Log type/orderId only — the full notification contains customer-facing content
      logger.log('[Notification] Received:', { type: notificationType, orderId: data?.orderId });

      // Handle NEW_DELIVERY_AVAILABLE - show order offer modal
      if (notificationType === PUSH_TYPES.NEW_DELIVERY_AVAILABLE) {
        logger.log('[Notification] NEW_DELIVERY_AVAILABLE received:', data?.orderId);

        // Only show modal if courier is online
        if (isOnline) {
          handleNewOrderPush({
            orderId: data?.orderId as string | number | undefined,
            orderNumber: data?.orderNumber as string | undefined,
            restaurantName: data?.restaurantName as string | undefined,
          });
        } else {
          // Show toast if offline
          const title = notification.request.content.title || 'New Delivery';
          const body = notification.request.content.body || '';
          toast.info(title, body);
        }
        return;
      }

      // For other notification types, refresh list and show toast
      fetchNotifications();
      fetchUnreadCount();

      const title = notification.request.content.title || 'New Notification';
      const body = notification.request.content.body || '';
      toast.info(title, body);
    });

    // Listen for notification taps (user interaction)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Handle the cold-start case: the app was launched by tapping a
    // notification, which fires before any listener is registered
    if (!hasHandledColdStartResponse.current) {
      hasHandledColdStartResponse.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then(response => {
          if (response) {
            logger.log('[Notification] Handling cold-start notification response');
            handleNotificationResponse(response);
          }
        })
        .catch(error => {
          logger.warn('[Notification] Failed to read cold-start notification response:', error);
        });
    }

    return () => {
      // SDK 54: subscriptions are removed via subscription.remove()
      notificationListener.current?.remove();
      notificationListener.current = null;
      responseListener.current?.remove();
      responseListener.current = null;
    };
  }, [fetchNotifications, fetchUnreadCount, handleNewOrderPush, isOnline, navigateWhenReady, router, toast]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();

    // Set up notification channels (creating channels never prompts the user)
    setupNotificationChannel();

    // Deliberately NO permission requests at cold start (Google Play
    // prominent-disclosure policy): location permission is only requested
    // from the go-online flow after the user accepts the
    // LocationDisclosureModal, and notification permission is requested
    // after login/session restore by registerDeviceToken().
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToastProvider>
          <CourierProvider>
            <ErrorBoundary onError={(error) => reportCrash(error, false)}>
              <NotificationHandler />
              <AuthNavigator>
                <RootLayoutNav />
              </AuthNavigator>
            </ErrorBoundary>
          </CourierProvider>
        </ToastProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingIndicator: {
    marginTop: 24,
  },
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { CourierProvider, useCourier } from "@/context/CourierContext";

import { ToastProvider, useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";
import Colors from "@/constants/colors";

import "@/i18n";

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

    // High priority channel for new orders
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'New Orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound: 'default',
      lightColor: '#059669',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
    });
  }
}

// Component to handle notification events (native only)
function NotificationHandler() {
  const router = useRouter();
  const toast = useToast();
  const { fetchNotifications, fetchUnreadCount } = useCourier();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Skip notification listeners on web - not fully supported
    if (Platform.OS === 'web') return;

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notification] Received:', notification);

      // Refresh notifications list
      fetchNotifications();
      fetchUnreadCount();

      // Show in-app toast
      const title = notification.request.content.title || 'New Notification';
      const body = notification.request.content.body || '';
      toast.show(`${title}: ${body}`, 'info');
    });

    // Listen for notification taps (user interaction)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Notification] User tapped:', response);

      const data = response.notification.request.content.data;

      // Navigate based on notification data
      if (data?.orderId) {
        router.push(`/order/${data.orderId}`);
      } else if (data?.actionUrl) {
        // Handle actionUrl like /orders/27
        const match = String(data.actionUrl).match(/\/orders\/(\d+)/);
        if (match) {
          router.push(`/order/${match[1]}`);
        }
      } else {
        // Default: go to notifications screen
        router.push('/notifications');
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [fetchNotifications, fetchUnreadCount, router, toast]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();

    // Set up notification channels
    setupNotificationChannel();

    // Request permissions on app open
    (async () => {
      // GPS Location Permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        console.log('Permission to access location was denied');
      }

      // Notification Permission
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        console.log('Permission to send notifications was denied');
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToastProvider>
          <CourierProvider>
            <NotificationHandler />
            <AuthNavigator>
              <RootLayoutNav />
            </AuthNavigator>
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

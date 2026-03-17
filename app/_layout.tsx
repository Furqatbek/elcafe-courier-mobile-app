import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { CourierProvider, useCourier } from "@/context/CourierContext";
import { FingerSwipeEffect } from "@/components/FingerSwipeEffect";
import { ToastProvider } from "@/components/Toast";
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


// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();

    // Request permissions on app open
    (async () => {
      // GPS Location Permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        console.log('Permission to access location was denied');
        // Optionally show alert only if critical
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
          <FingerSwipeEffect>
            <CourierProvider>
              <AuthNavigator>
                <RootLayoutNav />
              </AuthNavigator>
            </CourierProvider>
          </FingerSwipeEffect>
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

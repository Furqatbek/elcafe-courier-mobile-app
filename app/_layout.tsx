import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { CourierProvider } from "@/context/CourierContext";
import { FingerSwipeEffect } from "@/components/FingerSwipeEffect";
import Colors from "@/constants/colors";

import "@/i18n";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ 
      headerBackTitle: "Back",
      headerTintColor: Colors.primary,
      contentStyle: { backgroundColor: Colors.background }
    }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: false, presentation: 'card' }} />
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
        <FingerSwipeEffect>
          <CourierProvider>
            <RootLayoutNav />
          </CourierProvider>
        </FingerSwipeEffect>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

import { Tabs } from 'expo-router';
import React from 'react';
import { Package, DollarSign, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';

// Height of the icon + label row itself. The system navigation bar's inset is
// ADDED to this, never absorbed into it.
const TAB_ROW_HEIGHT = 60;
const TAB_ROW_PADDING = 8;

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          // The app is edge-to-edge, so the window extends behind the gesture
          // pill / 3-button navigation bar. The previous fixed height and
          // paddingBottom drew the tab row underneath it: the tabs were visible
          // through the translucent bar but every tap went to the system bar,
          // which is why navigation was impossible. Reserving insets.bottom
          // below the row keeps the touch targets above the system bar.
          //
          // React Navigation applies the bottom inset itself when tabBarStyle
          // sets neither height nor paddingBottom. Setting either one opts out
          // of that entirely, so once we override we must handle the inset -
          // this is a whole-value override, not a tweak on top of a default.
          height: TAB_ROW_HEIGHT + insets.bottom,
          paddingBottom: TAB_ROW_PADDING + insets.bottom,
          paddingTop: TAB_ROW_PADDING,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color }) => <Package size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: t('tabs.earnings'),
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

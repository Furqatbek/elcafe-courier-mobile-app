import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { User, Star, Bell, HelpCircle, LogOut, ChevronRight, Car, Globe, Smartphone, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';
import { useCourier } from '@/context/CourierContext';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';
import { registerDeviceToken, unregisterDeviceToken } from '@/services/pushNotification';
import logger from '@/lib/logger';

const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';

const TAB_ROUTES = [
  { name: 'orders', path: '/(tabs)/orders' },
  { name: 'finance', path: '/(tabs)/finance' },
  { name: 'settings', path: '/(tabs)/settings' },
];

// MenuItem component moved outside to prevent recreation on each render
const MenuItem = ({ icon: Icon, title, subtitle, onPress, danger, rightElement, loading }: any) => {
  const isDisabled = loading === true || (!onPress && !rightElement);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        isDisabled && styles.menuItemDisabled,
        pressed && !isDisabled && styles.menuItemPressed,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      <View style={[styles.iconContainer, danger && styles.dangerIconContainer]}>
        {loading ? (
          <ActivityIndicator size="small" color={danger ? Colors.danger : Colors.primary} />
        ) : (
          <Icon size={20} color={danger ? Colors.danger : Colors.primary} />
        )}
      </View>
      <View style={styles.menuInfo}>
        <Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement ? rightElement : <ChevronRight size={20} color={Colors.textLight} />}
    </Pressable>
  );
};

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, courierProfile, logout, logoutAllDevices, accessToken, authenticatedFetch } = useCourier();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Initialize the notifications toggle from persisted preference
  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
      .then((stored) => {
        if (stored !== null) {
          setNotificationsEnabled(stored === 'true');
        }
      })
      .catch((error) => {
        logger.error('Failed to load notifications preference:', error);
      });
  }, []);

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
      if (accessToken) {
        if (enabled) {
          await registerDeviceToken(accessToken);
        } else {
          await unregisterDeviceToken(accessToken);
        }
      }
    } catch (error) {
      logger.error('Failed to update notifications preference:', error);
    }
  };

  // Get display name from courierProfile or user
  const displayName = courierProfile?.userName ||
    (user ? `${user.firstName} ${user.lastName}` : '-');

  // Get initials for avatar
  const nameParts = displayName.split(' ');
  const initials = nameParts.length >= 2
    ? `${nameParts[0]?.[0] || ''}${nameParts[1]?.[0] || ''}`
    : displayName.substring(0, 2);

  // Get phone and rating from courierProfile
  const phone = courierProfile?.phone || user?.phone || '-';
  const rating = courierProfile?.averageRating ?? courierProfile?.rating ?? 0;

  const navigateToLanguage = () => {
    router.push('/language');
  };

  const handleLogout = async () => {
    const confirmLogout = Platform.OS === 'web'
      ? window.confirm(t('settings.logout_confirm'))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('settings.logout_title'),
            t('settings.logout_confirm'),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('settings.log_out'), style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (confirmLogout) {
      setIsLoggingOut(true);
      try {
        await logout();
        router.replace('/login');
      } catch (error) {
        logger.error('Logout failed:', error);
        router.replace('/login');
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleLogoutAllDevices = async () => {
    const confirmLogout = Platform.OS === 'web'
      ? window.confirm(t('settings.logout_all_confirm'))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('settings.logout_all_title'),
            t('settings.logout_all_confirm'),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('settings.logout_all'), style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (confirmLogout) {
      setIsLoggingOut(true);
      try {
        await logoutAllDevices();
        router.replace('/login');
      } catch (error) {
        logger.error('Logout all devices failed:', error);
        if (Platform.OS === 'web') {
          window.alert(t('settings.logout_all_failed'));
        } else {
          Alert.alert(t('common.error'), t('settings.logout_all_failed'));
        }
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(t('settings.delete_account_confirm', 'This will permanently delete your account, profile and delivery history. This action cannot be undone. Are you sure you want to delete your account?'))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('settings.delete_account_title', 'Delete Account'),
            t('settings.delete_account_confirm', 'This will permanently delete your account, profile and delivery history. This action cannot be undone. Are you sure you want to delete your account?'),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('settings.delete_account_button', 'Delete'), style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    setIsDeletingAccount(true);
    try {
      const response = await authenticatedFetch('/api/v1/users/me', {
        method: 'DELETE',
      });

      if (!response.ok) {
        let message = '';
        try {
          const data = await response.json();
          message = data?.message || '';
        } catch {
          // Non-JSON error body — fall through to generic message
        }
        throw new Error(message || `HTTP ${response.status}`);
      }

      await logout();
      router.replace('/login');
    } catch (error: any) {
      logger.error('Account deletion failed:', error);
      const message = error?.message
        ? `${t('settings.delete_account_failed', 'Failed to delete account. Please try again.')}\n\n${error.message}`
        : t('settings.delete_account_failed', 'Failed to delete account. Please try again.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert(t('common.error'), message);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="settings">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>{t('settings.title')}</Text>

      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profilePhone}>{phone}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {rating.toFixed(1)} {t('settings.rating')}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionHeader}>{t('settings.account')}</Text>
      <View style={styles.section}>
        <MenuItem 
          icon={User} 
          title={t('settings.personal_info')} 
          onPress={() => router.push('/personal-info')}
        />
        <MenuItem
          icon={Car}
          title={t('settings.vehicle_info')}
          onPress={() => router.push('/vehicle-info')}
        />
        <MenuItem
          icon={Star}
          title={t('settings.reviews')}
          onPress={() => router.push('/reviews')}
        />
      </View>

      <Text style={styles.sectionHeader}>{t('settings.preferences')}</Text>
      <View style={styles.section}>
        <MenuItem
          icon={Globe}
          title={t('settings.language')}
          subtitle={i18n.language === 'ru' ? 'Русский' : i18n.language === 'uz' ? "O'zbek" : 'English'}
          onPress={navigateToLanguage}
        />
        <MenuItem
          icon={Bell}
          title={t('settings.notifications')}
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#E2E8F0', true: Colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          }
        />
      </View>

      <Text style={styles.sectionHeader}>{t('settings.support')}</Text>
      <View style={styles.section}>
        <MenuItem
          icon={HelpCircle}
          title={t('settings.help_center')}
          onPress={() => router.push('/help-center')}
        />
      </View>

      <View style={[styles.section, styles.logoutSection]}>
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={20} color={Colors.danger} />
          <View style={styles.logoutButtonText}>
            <Text style={styles.logoutButtonTitle}>{t('settings.log_out')}</Text>
            <Text style={styles.logoutButtonSubtitle}>{t('settings.logout_subtitle')}</Text>
          </View>
          {isLoggingOut && <ActivityIndicator size="small" color={Colors.danger} />}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogoutAllDevices}
          disabled={isLoggingOut}
        >
          <Smartphone size={20} color={Colors.danger} />
          <View style={styles.logoutButtonText}>
            <Text style={styles.logoutButtonTitle}>{t('settings.logout_all')}</Text>
            <Text style={styles.logoutButtonSubtitle}>{t('settings.logout_all_subtitle')}</Text>
          </View>
          {isLoggingOut && <ActivityIndicator size="small" color={Colors.danger} />}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount || isLoggingOut}
        >
          <Trash2 size={20} color={Colors.danger} />
          <View style={styles.logoutButtonText}>
            <Text style={styles.logoutButtonTitle}>{t('settings.delete_account', 'Delete Account')}</Text>
            <Text style={styles.logoutButtonSubtitle}>{t('settings.delete_account_subtitle', 'Permanently delete your account and data')}</Text>
          </View>
          {isDeletingAccount && <ActivityIndicator size="small" color={Colors.danger} />}
        </Pressable>
      </View>
      
      <Text style={styles.version}>{t('settings.version', { version: '1.0.0' })}</Text>
      </ScrollView>
    </WithSwipeGesture>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 20,
    marginBottom: 24,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 20,
    marginBottom: 32,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.surface,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  profilePhone: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingContainer: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },

  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemPressed: {
    backgroundColor: Colors.background,
    opacity: 0.8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dangerIconContainer: {
    backgroundColor: '#FEF2F2',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dangerText: {
    color: Colors.danger,
  },
  logoutSection: {
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
    gap: 12,
  },
  logoutButtonPressed: {
    backgroundColor: '#FEE2E2',
    opacity: 0.9,
  },
  logoutButtonText: {
    flex: 1,
  },
  logoutButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  logoutButtonSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 12,
    marginTop: 12,
  },
});

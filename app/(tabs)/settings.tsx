import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { User, Shield, Bell, HelpCircle, LogOut, ChevronRight, Car, Settings as SettingsIcon, Globe, Smartphone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';
import { useCourier } from '@/context/CourierContext';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';

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
  const { user, logout, logoutAllDevices } = useCourier();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigateToLanguage = () => {
    router.push('/language');
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout_title'),
      t('settings.logout_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.log_out'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Logout failed:', error);
              // Still navigate to login even if API call fails
              router.replace('/login');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      t('settings.logout_all_title'),
      t('settings.logout_all_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout_all'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logoutAllDevices();
              router.replace('/login');
            } catch (error) {
              console.error('Logout all devices failed:', error);
              Alert.alert(t('common.error'), t('settings.logout_all_failed'));
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="settings">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>{t('settings.title')}</Text>

      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{user?.firstName?.[0] || 'J'}{user?.lastName?.[0] || 'D'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user ? `${user.firstName} ${user.lastName}` : 'John Doe'}</Text>
          <Text style={styles.profilePhone}>+1 (555) 123-4567</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ 4.9 {t('settings.rating')}</Text>
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
          icon={Shield}
          title={t('settings.security')}
          onPress={() => router.push('/security')}
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
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E2E8F0', true: Colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          }
        />
        <MenuItem 
          icon={SettingsIcon} 
          title={t('settings.app_settings')} 
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
        <MenuItem
          icon={LogOut}
          title={t('settings.log_out')}
          subtitle={t('settings.logout_subtitle')}
          danger
          onPress={handleLogout}
          loading={isLoggingOut}
        />
        <MenuItem
          icon={Smartphone}
          title={t('settings.logout_all')}
          subtitle={t('settings.logout_all_subtitle')}
          danger
          onPress={handleLogoutAllDevices}
          loading={isLoggingOut}
        />
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
  version: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 12,
    marginTop: 12,
  },
});

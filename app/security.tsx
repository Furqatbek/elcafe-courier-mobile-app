import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Lock,
  Shield,
  Smartphone,
  Key,
  Eye,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { validatePassword, validateConfirmPassword } from '@/lib/validation';

export default function SecurityScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Change Password Modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleToggle2FA = () => {
    if (!twoFactorEnabled) {
      Alert.alert(
        t('security.enable_2fa_title'),
        t('security.enable_2fa_message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('security.enable'),
            onPress: () => {
              // In production, initiate 2FA setup flow
              setTwoFactorEnabled(true);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('security.disable_2fa_title'),
        t('security.disable_2fa_message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('security.disable'),
            style: 'destructive',
            onPress: () => setTwoFactorEnabled(false),
          },
        ]
      );
    }
  };

  const handleToggleBiometric = () => {
    if (!biometricEnabled) {
      // In production, verify biometric availability
      setBiometricEnabled(true);
    } else {
      setBiometricEnabled(false);
    }
  };

  const validateChangePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    const currentResult = validatePassword(currentPassword);
    if (!currentResult.isValid) {
      newErrors.currentPassword = t('security.current_password_required');
    }

    const newResult = validatePassword(newPassword, 8);
    if (!newResult.isValid) {
      newErrors.newPassword = newResult.error || '';
    }

    const confirmResult = validateConfirmPassword(newPassword, confirmPassword);
    if (!confirmResult.isValid) {
      newErrors.confirmPassword = confirmResult.error || '';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validateChangePassword()) {
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, call your change password API
      // await api.changePassword({ currentPassword, newPassword });

      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});

      Alert.alert(t('common.success'), t('security.password_changed'));
    } catch (err: any) {
      Alert.alert(
        t('common.error_title'),
        err.message || t('security.password_change_failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('security.delete_account_title'),
      t('security.delete_account_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('security.delete'),
          style: 'destructive',
          onPress: () => {
            // In production, initiate account deletion
            Alert.alert(
              t('security.delete_requested'),
              t('security.delete_requested_message')
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('security.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Password Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('security.password')}</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowChangePassword(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Key size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>{t('security.change_password')}</Text>
                <Text style={styles.menuItemSubtitle}>
                  {t('security.change_password_sub')}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Two-Factor Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('security.two_factor')}</Text>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
                <Shield size={20} color={Colors.primary} />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>
                  {t('security.two_factor_auth')}
                </Text>
                <Text style={styles.menuItemSubtitle}>
                  {t('security.two_factor_sub')}
                </Text>
              </View>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        {/* Biometric Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('security.biometric')}</Text>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Smartphone size={20} color="#D97706" />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>
                  {t('security.biometric_login')}
                </Text>
                <Text style={styles.menuItemSubtitle}>
                  {t('security.biometric_sub')}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        {/* Active Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('security.sessions')}</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#F3E8FF' }]}>
                <Eye size={20} color="#9333EA" />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>
                  {t('security.active_sessions')}
                </Text>
                <Text style={styles.menuItemSubtitle}>
                  {t('security.active_sessions_sub')}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>
            {t('security.danger_zone')}
          </Text>

          <TouchableOpacity
            style={[styles.menuItem, styles.dangerItem]}
            onPress={handleDeleteAccount}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={20} color={Colors.danger} />
              </View>
              <View>
                <Text style={[styles.menuItemTitle, { color: Colors.danger }]}>
                  {t('security.delete_account')}
                </Text>
                <Text style={styles.menuItemSubtitle}>
                  {t('security.delete_account_sub')}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePassword}
        onClose={() => {
          setShowChangePassword(false);
          setErrors({});
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        title={t('security.change_password')}
        primaryAction={{
          label: t('security.update_password'),
          onPress: handleChangePassword,
          loading: isLoading,
        }}
        secondaryAction={{
          label: t('common.cancel'),
          onPress: () => setShowChangePassword(false),
        }}
      >
        <Input
          label={t('security.current_password')}
          placeholder={t('security.enter_current_password')}
          value={currentPassword}
          onChangeText={(text) => {
            setCurrentPassword(text);
            setErrors(prev => ({ ...prev, currentPassword: '' }));
          }}
          isPassword
          icon={Lock}
          error={errors.currentPassword}
        />

        <Input
          label={t('security.new_password')}
          placeholder={t('security.enter_new_password')}
          value={newPassword}
          onChangeText={(text) => {
            setNewPassword(text);
            setErrors(prev => ({ ...prev, newPassword: '' }));
          }}
          isPassword
          icon={Lock}
          error={errors.newPassword}
        />

        <Input
          label={t('security.confirm_new_password')}
          placeholder={t('security.confirm_new_password_placeholder')}
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            setErrors(prev => ({ ...prev, confirmPassword: '' }));
          }}
          isPassword
          icon={Lock}
          error={errors.confirmPassword}
        />

        <Text style={styles.passwordHint}>{t('security.password_requirements')}</Text>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  dangerItem: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  passwordHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
});

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { APP_CONFIG } from '@/constants/config';

// Only offer "Contact support" when a real support email is configured —
// the default courierapp.com address is a placeholder.
const SUPPORT_EMAIL: string = APP_CONFIG.SUPPORT_EMAIL;
const hasRealSupportEmail =
  !!SUPPORT_EMAIL && !SUPPORT_EMAIL.toLowerCase().includes('courierapp.com');

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handlePhoneLogin = () => {
    router.replace('/login-otp');
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <KeyRound size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{t('forgot_password.title')}</Text>
          <Text style={styles.subtitle}>
            {t(
              'forgot_password.no_email_reset',
              'Password reset by email is not available yet. You can log in without a password using a one-time code sent to your phone.'
            )}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={t('forgot_password.login_with_phone', 'Log in with phone code')}
            onPress={handlePhoneLogin}
            style={styles.phoneButton}
          />

          {hasRealSupportEmail && (
            <TouchableOpacity
              style={styles.supportButton}
              onPress={handleContactSupport}
            >
              <Mail size={18} color={Colors.primary} />
              <Text style={styles.supportButtonText}>
                {t('forgot_password.contact_support', 'Contact support')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('forgot_password.remember_password')}</Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.linkText}>{t('login.login_button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  actions: {
    marginBottom: 32,
  },
  phoneButton: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    gap: 8,
  },
  supportButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 32,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },
});

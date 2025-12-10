import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Box, Lock, Mail } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { useCourier } from '@/context/CourierContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useCourier();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error_title'), t('common.fill_all_fields'));
      return;
    }
    
    setIsLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/orders');
    } catch (error: any) {
      Alert.alert(t('common.error_title'), error.message || t('login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Box size={40} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>Courier<Text style={styles.appNameHighlight}>Pro</Text></Text>
            <Text style={styles.subtitle}>{t('login.app_subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Mail size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.email_placeholder')}
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Lock size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.password_placeholder')}
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>{t('login.forgot_password')}</Text>
            </TouchableOpacity>

            <Button 
              title={t('login.login_button')} 
              onPress={handleLogin} 
              isLoading={isLoading} 
              style={styles.loginButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('login.no_account')}</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.linkText}>{t('login.sign_up')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
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
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: -0.5,
  },
  appNameHighlight: {
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});

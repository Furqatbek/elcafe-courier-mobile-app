import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TouchableWithoutFeedback, Keyboard, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, User, Phone, Eye, EyeOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { BASE_URL, API_ENDPOINTS } from '@/constants/config';
import { Logo } from '@/components/Logo';

// Terms/Privacy only render as links when their URLs are configured;
// otherwise they show as plain text (no dead links).
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

// Field error state type
interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Clear specific field error when user starts typing
  const handleFieldChange = (field: keyof FieldErrors, value: string, setter: (v: string) => void) => {
    setter(value);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Parse backend validation errors
  const parseBackendErrors = (data: any): FieldErrors => {
    const fieldErrors: FieldErrors = {};

    if (data && typeof data === 'object') {
      // Map backend field names to our field names
      const fieldMapping: Record<string, keyof FieldErrors> = {
        firstName: 'firstName',
        lastName: 'lastName',
        email: 'email',
        phone: 'phone',
        password: 'password',
        confirmPassword: 'confirmPassword',
      };

      Object.keys(data).forEach(key => {
        const mappedField = fieldMapping[key];
        if (mappedField) {
          fieldErrors[mappedField] = data[key];
        }
      });
    }

    return fieldErrors;
  };

  const handleRegister = async () => {
    // Clear previous errors
    setErrors({});

    // Client-side validation
    const newErrors: FieldErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = t('register.first_name_required', 'First name is required');
    }
    if (!lastName.trim()) {
      newErrors.lastName = t('register.last_name_required', 'Last name is required');
    }
    if (!email.trim()) {
      newErrors.email = t('register.email_required', 'Email is required');
    }
    if (!phone.trim()) {
      newErrors.phone = t('register.phone_required', 'Phone number is required');
    }
    if (!password) {
      newErrors.password = t('register.password_required', 'Password is required');
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = t('register.confirm_password_required', 'Please confirm your password');
    }
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = t('register.password_mismatch', 'Passwords do not match');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          t('common.success'),
          t('register.registration_success'),
          [
            {
              text: t('common.ok'),
              onPress: () => router.replace('/login'),
            }
          ]
        );
      } else {
        // Parse field-specific errors from backend
        if (data.data && typeof data.data === 'object') {
          const fieldErrors = parseBackendErrors(data.data);
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          } else {
            // Fallback to general error message
            setErrors({ general: data.message || t('register.registration_failed') });
          }
        } else {
          // No field-specific errors, show general message
          setErrors({ general: data.message || t('register.registration_failed') });
        }
      }
    } catch (error: any) {
      setErrors({ general: error.message || t('register.registration_failed') });
    } finally {
      setIsLoading(false);
    }
  };

  // Error text component
  const ErrorText = ({ error }: { error?: string }) => {
    if (!error) return null;
    return <Text style={styles.errorText}>{error}</Text>;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Logo size={80} />
              <Text style={styles.appName}>ZBR <Text style={styles.appNameHighlight}>Courier</Text></Text>
              <Text style={styles.subtitle}>{t('register.create_account_subtitle')}</Text>
            </View>

            {/* General error message */}
            {errors.general && (
              <View style={styles.generalErrorContainer}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.row}>
                <View style={styles.halfWidthContainer}>
                  <View style={[styles.inputContainer, errors.firstName && styles.inputContainerError]}>
                    <User size={20} color={errors.firstName ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('register.first_name_placeholder')}
                      placeholderTextColor={Colors.textLight}
                      value={firstName}
                      onChangeText={(v) => handleFieldChange('firstName', v, setFirstName)}
                      autoCapitalize="words"
                    />
                  </View>
                  <ErrorText error={errors.firstName} />
                </View>

                <View style={styles.halfWidthContainer}>
                  <View style={[styles.inputContainer, errors.lastName && styles.inputContainerError]}>
                    <User size={20} color={errors.lastName ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('register.last_name_placeholder')}
                      placeholderTextColor={Colors.textLight}
                      value={lastName}
                      onChangeText={(v) => handleFieldChange('lastName', v, setLastName)}
                      autoCapitalize="words"
                    />
                  </View>
                  <ErrorText error={errors.lastName} />
                </View>
              </View>

              <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
                <Mail size={20} color={errors.email ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.email_placeholder')}
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={(v) => handleFieldChange('email', v, setEmail)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <ErrorText error={errors.email} />

              <View style={[styles.inputContainer, errors.phone && styles.inputContainerError]}>
                <Phone size={20} color={errors.phone ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phone_placeholder')}
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={(v) => handleFieldChange('phone', v, setPhone)}
                  keyboardType="phone-pad"
                />
              </View>
              <ErrorText error={errors.phone} />

              <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
                <Lock size={20} color={errors.password ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.password_placeholder')}
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={(v) => handleFieldChange('password', v, setPassword)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textLight} />
                  ) : (
                    <Eye size={20} color={Colors.textLight} />
                  )}
                </TouchableOpacity>
              </View>
              <ErrorText error={errors.password} />

              <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
                <Lock size={20} color={errors.confirmPassword ? Colors.danger : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.confirm_password_placeholder')}
                  placeholderTextColor={Colors.textLight}
                  value={confirmPassword}
                  onChangeText={(v) => handleFieldChange('confirmPassword', v, setConfirmPassword)}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textLight} />
                  ) : (
                    <Eye size={20} color={Colors.textLight} />
                  )}
                </TouchableOpacity>
              </View>
              <ErrorText error={errors.confirmPassword} />

              <Text style={styles.termsText}>
                {t('register.by_signing_up')}{' '}
                {TERMS_URL ? (
                  <Text style={styles.linkText} onPress={() => Linking.openURL(TERMS_URL)}>{t('register.terms')}</Text>
                ) : (
                  <Text>{t('register.terms')}</Text>
                )}{' '}
                {t('register.and')}{' '}
                {PRIVACY_URL ? (
                  <Text style={styles.linkText} onPress={() => Linking.openURL(PRIVACY_URL)}>{t('register.privacy')}</Text>
                ) : (
                  <Text>{t('register.privacy')}</Text>
                )}
              </Text>

              <Button
                title={t('register.register_button')}
                onPress={handleRegister}
                isLoading={isLoading}
                style={styles.registerButton}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('register.have_account')}</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkTextFooter}>{t('register.login')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800' as const,
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
  generalErrorContainer: {
    backgroundColor: Colors.danger + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  generalErrorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  halfWidthContainer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputContainerError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + '08',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 2,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  registerButton: {
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
    marginTop: 16,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkTextFooter: {
    color: Colors.primary,
    fontWeight: '700' as const,
    fontSize: 14,
  },
});

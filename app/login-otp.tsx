import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Phone, ArrowLeft, ArrowRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { useCourier } from '@/context/CourierContext';

type Step = 'phone' | 'otp';

// The UI shows a fixed +998 prefix; normalize whatever the user typed into a
// full E.164-style number for the backend.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('998') ? `+${digits}` : `+998${digits}`;
}

export default function LoginOtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { requestOtp, verifyOtp } = useCourier();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      toast.error(t('login_otp.enter_phone'));
      return;
    }

    if (!APP_CONFIG.PHONE_REGEX.test(phone)) {
      toast.error(t('login_otp.invalid_phone'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestOtp(normalizePhone(phone));
      if (!result.success) {
        toast.error(result.message || t('login_otp.otp_request_failed'));
        return;
      }
      setStep('otp');
      setResendTimer(APP_CONFIG.OTP_RESEND_DELAY);
      toast.success(t('login_otp.otp_sent'));
      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      toast.error(error.message || t('login_otp.otp_request_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, '');
      setOtp(newOtp);

      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error(t('login_otp.enter_complete_otp'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyOtp(normalizePhone(phone), otpCode);
      if (!result.success || !result.data) {
        toast.error(result.message || t('login_otp.verification_failed'));
        return;
      }
      router.replace('/(tabs)/orders');
    } catch (error: any) {
      toast.error(error.message || t('login_otp.verification_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setIsLoading(true);
    try {
      const result = await requestOtp(normalizePhone(phone));
      if (!result.success) {
        toast.error(result.message || t('login_otp.otp_request_failed'));
        return;
      }
      setResendTimer(APP_CONFIG.OTP_RESEND_DELAY);
      setOtp(['', '', '', '', '', '']);
      toast.success(t('login_otp.otp_resent'));
    } catch (error: any) {
      toast.error(error.message || t('login_otp.otp_request_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => step === 'otp' ? setStep('phone') : router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Phone size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>
            {step === 'phone' ? t('login_otp.title') : t('login_otp.verify_title')}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? t('login_otp.subtitle')
              : t('login_otp.verify_subtitle', { phone })}
          </Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.form}>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.phonePrefix}>+998</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder={t('login_otp.phone_placeholder')}
                placeholderTextColor={Colors.textLight}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <>
                  <Text style={styles.buttonText}>{t('login_otp.send_code')}</Text>
                  <ArrowRight size={20} color={Colors.surface} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { otpInputRefs.current[index] = ref; }}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <Text style={styles.buttonText}>{t('login_otp.verify')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resendTimer > 0}
            >
              <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
                {resendTimer > 0
                  ? t('login_otp.resend_in', { seconds: resendTimer })
                  : t('login_otp.resend_code')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.switchMethod} onPress={() => router.replace('/login')}>
          <Text style={styles.switchMethodText}>{t('login_otp.use_email')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -12,
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    flex: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  phonePrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    height: 56,
    fontSize: 18,
    color: Colors.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.text,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  button: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
  },
  resendButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: Colors.textLight,
  },
  switchMethod: {
    marginTop: 32,
    alignItems: 'center',
  },
  switchMethodText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

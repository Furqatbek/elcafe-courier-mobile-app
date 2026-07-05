import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useCourier } from '@/context/CourierContext';
import { userApi } from '@/services/api';
import { validateEmail, validatePhone, validateRequired } from '@/lib/validation';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, fetchCourierProfile } = useCourier();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const firstNameResult = validateRequired(firstName, t('edit_profile.first_name'));
    if (!firstNameResult.isValid) {
      newErrors.firstName = firstNameResult.error || '';
    }

    const lastNameResult = validateRequired(lastName, t('edit_profile.last_name'));
    if (!lastNameResult.isValid) {
      newErrors.lastName = lastNameResult.error || '';
    }

    const emailResult = validateEmail(email);
    if (!emailResult.isValid) {
      newErrors.email = emailResult.error || '';
    }

    const phoneResult = validatePhone(phone);
    if (!phoneResult.isValid) {
      newErrors.phone = phoneResult.error || '';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Personal fields go to the USER resource — PUT /couriers/me silently
      // ignores them (backend-verified), which made this save a no-op before
      await userApi.updatePersonalInfo({ firstName, lastName, email, phone });
      await fetchCourierProfile();

      Alert.alert(
        t('common.success'),
        t('edit_profile.profile_updated'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error_title'),
        err.message || t('edit_profile.update_failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    const first = firstName.charAt(0).toUpperCase();
    const last = lastName.charAt(0).toUpperCase();
    return `${first}${last}` || 'U';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_profile.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Avatar (initials only — photo upload is not supported) */}
        <View style={styles.photoSection}>
          <View style={styles.initialsContainer}>
            <Text style={styles.initials}>{getInitials()}</Text>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label={t('edit_profile.first_name')}
                placeholder={t('register.first_name_placeholder')}
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  setErrors(prev => ({ ...prev, firstName: '' }));
                }}
                icon={User}
                error={errors.firstName}
                required
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label={t('edit_profile.last_name')}
                placeholder={t('register.last_name_placeholder')}
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  setErrors(prev => ({ ...prev, lastName: '' }));
                }}
                error={errors.lastName}
                required
              />
            </View>
          </View>

          <Input
            label={t('edit_profile.email')}
            placeholder={t('login.email_placeholder')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors(prev => ({ ...prev, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={Mail}
            error={errors.email}
            required
          />

          <Input
            label={t('edit_profile.phone')}
            placeholder={t('register.phone_placeholder')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setErrors(prev => ({ ...prev, phone: '' }));
            }}
            keyboardType="phone-pad"
            icon={Phone}
            error={errors.phone}
            required
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('edit_profile.save_changes')}
            onPress={handleSave}
            isLoading={isLoading}
          />
        </View>
      </ScrollView>
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
    padding: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  initialsContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.surface,
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: 8,
  },
});

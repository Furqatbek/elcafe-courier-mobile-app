import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bike, Car, CheckCircle, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { VehicleType, DEFAULTS } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { api } from '@/services/api';
import { useCourier } from '@/context/CourierContext';

const vehicleIcons = {
  BICYCLE: Bike,
  MOTORCYCLE: Bike,
  CAR: Car,
};

export default function BecomeCourierScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { fetchCourierProfile } = useCourier();

  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORCYCLE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [preferredRadius, setPreferredRadius] = useState(DEFAULTS.DEFAULT_RADIUS_KM.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!vehicleNumber.trim()) {
      newErrors.vehicleNumber = t('become_courier.vehicle_number_required');
    } else if (vehicleNumber.trim().length < 4) {
      newErrors.vehicleNumber = t('become_courier.vehicle_number_invalid');
    }

    if (!licenseNumber.trim()) {
      newErrors.licenseNumber = t('become_courier.license_required');
    } else if (licenseNumber.trim().length < 6) {
      newErrors.licenseNumber = t('become_courier.license_invalid');
    }

    const radius = parseInt(preferredRadius);
    if (isNaN(radius) || radius < 1 || radius > 50) {
      newErrors.preferredRadius = t('become_courier.radius_invalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await api.courier.register({
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        preferredRadiusKm: parseInt(preferredRadius),
      });

      await fetchCourierProfile();
      toast.success(t('become_courier.success'));
      router.replace('/verification-pending');
    } catch (error: any) {
      toast.error(error.message || t('become_courier.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderVehicleOption = (type: VehicleType, label: string) => {
    const Icon = vehicleIcons[type] || Car;
    const isSelected = vehicleType === type;

    return (
      <TouchableOpacity
        key={type}
        style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]}
        onPress={() => setVehicleType(type)}
      >
        <Icon size={32} color={isSelected ? Colors.primary : Colors.textSecondary} />
        <Text style={[styles.vehicleLabel, isSelected && styles.vehicleLabelSelected]}>
          {label}
        </Text>
        {isSelected && (
          <CheckCircle size={20} color={Colors.primary} style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('become_courier.title') }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('become_courier.header')}</Text>
          <Text style={styles.subtitle}>{t('become_courier.subtitle')}</Text>
        </View>

        {/* Vehicle Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('become_courier.vehicle_type')}</Text>
          <View style={styles.vehicleGrid}>
            {renderVehicleOption('BICYCLE', t('become_courier.bicycle'))}
            {renderVehicleOption('MOTORCYCLE', t('become_courier.motorcycle'))}
            {renderVehicleOption('CAR', t('become_courier.car'))}
          </View>
        </View>

        {/* Vehicle Number */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('become_courier.vehicle_number')}</Text>
          <TextInput
            style={[styles.input, errors.vehicleNumber && styles.inputError]}
            placeholder={t('become_courier.vehicle_number_placeholder')}
            placeholderTextColor={Colors.textLight}
            value={vehicleNumber}
            onChangeText={(text) => {
              setVehicleNumber(text);
              if (errors.vehicleNumber) setErrors({ ...errors, vehicleNumber: '' });
            }}
            autoCapitalize="characters"
          />
          {errors.vehicleNumber && (
            <View style={styles.errorContainer}>
              <AlertCircle size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{errors.vehicleNumber}</Text>
            </View>
          )}
        </View>

        {/* License Number */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('become_courier.license_number')}</Text>
          <TextInput
            style={[styles.input, errors.licenseNumber && styles.inputError]}
            placeholder={t('become_courier.license_placeholder')}
            placeholderTextColor={Colors.textLight}
            value={licenseNumber}
            onChangeText={(text) => {
              setLicenseNumber(text);
              if (errors.licenseNumber) setErrors({ ...errors, licenseNumber: '' });
            }}
            autoCapitalize="characters"
          />
          {errors.licenseNumber && (
            <View style={styles.errorContainer}>
              <AlertCircle size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{errors.licenseNumber}</Text>
            </View>
          )}
        </View>

        {/* Preferred Radius */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('become_courier.preferred_radius')}</Text>
          <View style={styles.radiusContainer}>
            <TextInput
              style={[styles.radiusInput, errors.preferredRadius && styles.inputError]}
              value={preferredRadius}
              onChangeText={(text) => {
                setPreferredRadius(text.replace(/\D/g, ''));
                if (errors.preferredRadius) setErrors({ ...errors, preferredRadius: '' });
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.radiusUnit}>km</Text>
          </View>
          <Text style={styles.hint}>{t('become_courier.radius_hint')}</Text>
          {errors.preferredRadius && (
            <View style={styles.errorContainer}>
              <AlertCircle size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{errors.preferredRadius}</Text>
            </View>
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <AlertCircle size={20} color={Colors.primary} />
          <Text style={styles.infoText}>{t('become_courier.verification_note')}</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.submitButtonText}>{t('become_courier.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  vehicleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  vehicleLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  vehicleLabelSelected: {
    color: Colors.primary,
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
  },
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radiusInput: {
    width: 80,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  radiusUnit: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  submitButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
  },
});

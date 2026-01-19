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
  Car,
  FileText,
  Hash,
  Truck,
  Bike,
  CheckCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useCourier } from '@/context/CourierContext';
import { validateRequired, validateLicensePlate } from '@/lib/validation';

type VehicleType = 'car' | 'motorcycle' | 'bicycle' | 'scooter';

interface VehicleOption {
  type: VehicleType;
  label: string;
  icon: typeof Car;
}

export default function EditVehicleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useCourier();

  const [vehicleType, setVehicleType] = useState<VehicleType>(
    (user?.vehicleType as VehicleType) || 'car'
  );
  const [vehicleBrand, setVehicleBrand] = useState(user?.vehicleBrand || '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel || '');
  const [vehiclePlate, setVehiclePlate] = useState(user?.vehiclePlate || '');
  const [licenseNumber, setLicenseNumber] = useState(user?.licenseNumber || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vehicleOptions: VehicleOption[] = [
    { type: 'car', label: t('edit_vehicle.car'), icon: Car },
    { type: 'motorcycle', label: t('edit_vehicle.motorcycle'), icon: Bike },
    { type: 'bicycle', label: t('edit_vehicle.bicycle'), icon: Bike },
    { type: 'scooter', label: t('edit_vehicle.scooter'), icon: Truck },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (vehicleType !== 'bicycle') {
      const brandResult = validateRequired(vehicleBrand, t('edit_vehicle.brand'));
      if (!brandResult.isValid) {
        newErrors.vehicleBrand = brandResult.error || '';
      }

      const modelResult = validateRequired(vehicleModel, t('edit_vehicle.model'));
      if (!modelResult.isValid) {
        newErrors.vehicleModel = modelResult.error || '';
      }

      const plateResult = validateLicensePlate(vehiclePlate);
      if (!plateResult.isValid) {
        newErrors.vehiclePlate = plateResult.error || '';
      }
    }

    const licenseResult = validateRequired(licenseNumber, t('edit_vehicle.license_number'));
    if (!licenseResult.isValid) {
      newErrors.licenseNumber = licenseResult.error || '';
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
      // Simulate API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, call your vehicle update API here
      // await api.updateVehicle({ vehicleType, vehicleBrand, vehicleModel, vehiclePlate, licenseNumber });

      Alert.alert(
        t('common.success'),
        t('edit_vehicle.vehicle_updated'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error_title'),
        err.message || t('edit_vehicle.update_failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_vehicle.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vehicle Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('edit_vehicle.vehicle_type')}</Text>
          <View style={styles.vehicleTypeGrid}>
            {vehicleOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = vehicleType === option.type;
              return (
                <TouchableOpacity
                  key={option.type}
                  style={[
                    styles.vehicleTypeCard,
                    isSelected && styles.vehicleTypeCardSelected,
                  ]}
                  onPress={() => setVehicleType(option.type)}
                >
                  <Icon
                    size={28}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeLabel,
                      isSelected && styles.vehicleTypeLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <CheckCircle size={16} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Vehicle Details */}
        {vehicleType !== 'bicycle' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('edit_vehicle.vehicle_details')}</Text>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label={t('edit_vehicle.brand')}
                  placeholder={t('edit_vehicle.brand_placeholder')}
                  value={vehicleBrand}
                  onChangeText={(text) => {
                    setVehicleBrand(text);
                    setErrors(prev => ({ ...prev, vehicleBrand: '' }));
                  }}
                  icon={Car}
                  error={errors.vehicleBrand}
                  required
                />
              </View>
              <View style={styles.halfInput}>
                <Input
                  label={t('edit_vehicle.model')}
                  placeholder={t('edit_vehicle.model_placeholder')}
                  value={vehicleModel}
                  onChangeText={(text) => {
                    setVehicleModel(text);
                    setErrors(prev => ({ ...prev, vehicleModel: '' }));
                  }}
                  error={errors.vehicleModel}
                  required
                />
              </View>
            </View>

            <Input
              label={t('edit_vehicle.plate_number')}
              placeholder={t('edit_vehicle.plate_placeholder')}
              value={vehiclePlate}
              onChangeText={(text) => {
                setVehiclePlate(text.toUpperCase());
                setErrors(prev => ({ ...prev, vehiclePlate: '' }));
              }}
              autoCapitalize="characters"
              icon={Hash}
              error={errors.vehiclePlate}
              required
            />
          </View>
        )}

        {/* License Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('edit_vehicle.license_info')}</Text>

          <Input
            label={t('edit_vehicle.license_number')}
            placeholder={t('edit_vehicle.license_placeholder')}
            value={licenseNumber}
            onChangeText={(text) => {
              setLicenseNumber(text);
              setErrors(prev => ({ ...prev, licenseNumber: '' }));
            }}
            icon={FileText}
            error={errors.licenseNumber}
            required
          />

          <Text style={styles.helperText}>
            {t('edit_vehicle.license_helper')}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('edit_vehicle.save_changes')}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vehicleTypeCard: {
    width: '47%',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  vehicleTypeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#ECFDF5',
  },
  vehicleTypeLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  vehicleTypeLabelSelected: {
    color: Colors.primary,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 8,
  },
});

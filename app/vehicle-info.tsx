import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Car, FileText, Tag, Box, CreditCard, Edit2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';

export default function VehicleInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { courierProfile, fetchCourierProfile } = useCourier();
  const [isLoading, setIsLoading] = React.useState(false);

  // Refresh profile data when screen loads
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        await fetchCourierProfile();
      } catch (error) {
        console.error('Failed to fetch courier profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [fetchCourierProfile]);

  const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <View style={styles.item}>
      <View style={styles.iconContainer}>
        <Icon size={20} color={Colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || '-'}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('vehicle_info.title') }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('vehicle_info.title'),
          headerRight: () => (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/edit-vehicle')}
            >
              <Edit2 size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <InfoItem
            icon={Car}
            label={t('vehicle_info.vehicle_type')}
            value={courierProfile?.vehicleType || '-'}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={CreditCard}
            label={t('vehicle_info.vehicle_plate')}
            value={courierProfile?.vehicleNumber || '-'}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={FileText}
            label={t('vehicle_info.license_number')}
            value={courierProfile?.licenseNumber || '-'}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border || '#E2E8F0',
    marginLeft: 56,
  },
});

import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Hash, Briefcase, UserCircle, Edit2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';

export default function PersonalInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, courierProfile, fetchCourierProfile } = useCourier();
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

  // Parse userName into first/last name if available
  const nameParts = (courierProfile?.userName || '').split(' ');
  const firstName = courierProfile?.firstName || nameParts[0] || user?.firstName || '-';
  const lastName = courierProfile?.lastName || nameParts.slice(1).join(' ') || user?.lastName || '-';

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
        <Stack.Screen options={{ title: t('personal_info.title') }} />
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
          title: t('personal_info.title'),
          headerRight: () => (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/edit-profile')}
            >
              <Edit2 size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t('personal_info.personal_details')}</Text>
        <View style={styles.section}>
          <InfoItem
            icon={Hash}
            label={t('personal_info.id')}
            value={courierProfile?.id || user?.id || '-'}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={User}
            label={t('personal_info.first_name')}
            value={firstName}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={UserCircle}
            label={t('personal_info.last_name')}
            value={lastName}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={Phone}
            label={t('personal_info.phone')}
            value={courierProfile?.phone || user?.phone || '-'}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={Mail}
            label={t('personal_info.email')}
            value={courierProfile?.email || user?.email || '-'}
          />
          <View style={styles.separator} />

          <InfoItem
            icon={Briefcase}
            label={t('personal_info.courier_type')}
            value={t('personal_info.standard_courier')}
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
    paddingBottom: 40,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    backgroundColor: Colors.border, // Assuming Colors.border exists, otherwise use '#E2E8F0'
    marginLeft: 56, // Align with text
  },
});

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Hash, Briefcase, UserCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';

export default function PersonalInfoScreen() {
  const { t } = useTranslation();
  const { user } = useCourier();

  const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <View style={styles.item}>
      <View style={styles.iconContainer}>
        <Icon size={20} color={Colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('settings.personal_info') }} />
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t('personal_info.personal_details')}</Text>
        <View style={styles.section}>
          <InfoItem 
            icon={Hash} 
            label={t('personal_info.id')} 
            value={user?.id || '-'} 
          />
          <View style={styles.separator} />
          
          <InfoItem 
            icon={User} 
            label={t('personal_info.first_name')} 
            value={user?.firstName || 'John'} 
          />
          <View style={styles.separator} />
          
          <InfoItem 
            icon={UserCircle} 
            label={t('personal_info.last_name')} 
            value={user?.lastName || 'Doe'} 
          />
          <View style={styles.separator} />
          
          <InfoItem 
            icon={Phone} 
            label={t('personal_info.phone')} 
            value={user?.phone || "+1 (555) 123-4567"} 
          />
          <View style={styles.separator} />
          
          <InfoItem 
            icon={Mail} 
            label={t('personal_info.email')} 
            value={user?.email || 'john.doe@example.com'} 
          />
          <View style={styles.separator} />
          
          <InfoItem 
            icon={Briefcase} 
            label={t('personal_info.courier_type')} 
            value={user?.role === 'courier' ? t('personal_info.standard_courier') : (user?.role || t('personal_info.standard_courier'))} 
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

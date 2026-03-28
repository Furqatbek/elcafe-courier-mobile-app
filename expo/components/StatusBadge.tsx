import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OrderStatus } from '@/context/CourierContext';
import Colors from '@/constants/colors';

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();

  const getStyle = () => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#D97706' }; // Amber
      case 'pickup':
        return { bg: '#DBEAFE', text: '#2563EB' }; // Blue
      case 'delivery':
        return { bg: '#E0F2FE', text: '#0284C7' }; // Sky
      case 'completed':
        return { bg: '#D1FAE5', text: '#059669' }; // Emerald
      default:
        return { bg: Colors.background, text: Colors.text };
    }
  };

  const style = getStyle();

  const getStatusText = () => {
    switch (status) {
      case 'pending': return t('common.status_pending');
      case 'pickup': return t('common.status_pickup');
      case 'delivery': return t('common.status_delivery');
      case 'completed': return t('common.status_completed');
      default: return (status as string).toUpperCase();
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});

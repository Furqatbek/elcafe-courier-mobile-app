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
      case 'PENDING':
        return { bg: '#FEF3C7', text: '#D97706' }; // Amber
      case 'READY':
        return { bg: '#FEF9C3', text: '#CA8A04' }; // Yellow
      case 'ACCEPTED':
      case 'COURIER_ASSIGNED':
        return { bg: '#DBEAFE', text: '#2563EB' }; // Blue
      case 'PICKED_UP':
        return { bg: '#E0F2FE', text: '#0284C7' }; // Sky
      case 'IN_TRANSIT':
      case 'DELIVERING':
        return { bg: '#FEE2E2', text: '#DC2626' }; // Red (urgent)
      case 'DELIVERED':
        return { bg: '#D1FAE5', text: '#059669' }; // Emerald
      case 'CANCELLED':
        return { bg: '#F3F4F6', text: '#6B7280' }; // Gray
      default:
        return { bg: Colors.background, text: Colors.text };
    }
  };

  const style = getStyle();

  const getStatusText = () => {
    switch (status) {
      case 'PENDING': return t('common.status_pending', 'PENDING');
      case 'READY': return t('common.status_ready', 'READY');
      case 'ACCEPTED':
      case 'COURIER_ASSIGNED': return t('common.status_accepted', 'ACCEPTED');
      case 'PICKED_UP': return t('common.status_picked_up', 'PICKED UP');
      case 'IN_TRANSIT': return t('common.status_in_transit', 'IN TRANSIT');
      case 'DELIVERING': return t('common.status_delivering', 'DELIVERING');
      case 'DELIVERED': return t('common.status_delivered', 'DELIVERED');
      case 'CANCELLED': return t('common.status_cancelled', 'CANCELLED');
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

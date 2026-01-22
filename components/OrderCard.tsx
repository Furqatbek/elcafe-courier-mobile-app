import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MapPin, Package, CreditCard } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { Order } from '@/context/CourierContext';
import { StatusBadge } from './StatusBadge';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface OrderCardProps {
  order: Order;
  showActions?: boolean;
}

export function OrderCard({ order, showActions = true }: OrderCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = () => {
    router.push(`/order/${order.orderId}`);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {order.restaurant.name}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.row}>
        <MapPin size={16} color={Colors.textLight} />
        <Text style={styles.address} numberOfLines={1}>
          {order.restaurant.address}
        </Text>
      </View>

      <View style={styles.connector} />

      <View style={styles.row}>
        <MapPin size={16} color={Colors.primary} />
        <Text style={styles.address} numberOfLines={1}>
          {order.deliveryAddress.fullAddress}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Text style={styles.amountText}>{formatCurrency(order.totalAmount)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Package size={14} color={Colors.textLight} />
          <Text style={styles.infoText}>{order.items.length} {t('orders.items', 'items')}</Text>
        </View>
        <View style={styles.infoItem}>
          <CreditCard size={14} color={order.isPaid ? Colors.success : Colors.accent} />
          <Text style={[styles.paymentText, { color: order.isPaid ? Colors.success : Colors.accent }]}>
            {order.isPaid ? t('order_detail.paid', 'Paid') : order.paymentMethod}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 2,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  connector: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 7,
    marginVertical: 2,
  },
  address: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.background,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MapPin, Package, CreditCard } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Order } from '@/context/CourierContext';
import { formatCurrency, courierEarnings } from '@/lib/formatting';
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

  // Support both nested and flat data structures from backend
  const restaurantName = order.restaurant?.name ?? (order as any).restaurantName ?? '-';
  const restaurantAddress = order.restaurant?.address ?? (order as any).restaurantAddress ?? '-';
  const deliveryAddress = order.deliveryAddress?.fullAddress ?? (order as any).deliveryAddress ?? '-';
  const itemCount = order.items?.length ?? (order as any).itemCount ?? 0;
  // In active/history lists the courier cares about THEIR earnings
  // (delivery fee + tip), never the order total — label it explicitly.
  const earningsAmount = courierEarnings(order);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderNumber}>{order.orderNumber ?? (order as any).externalOrderNo}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurantName}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.row}>
        <MapPin size={16} color={Colors.textLight} />
        <Text style={styles.address} numberOfLines={1}>
          {restaurantAddress}
        </Text>
      </View>

      <View style={styles.connector} />

      <View style={styles.row}>
        <MapPin size={16} color={Colors.primary} />
        <Text style={styles.address} numberOfLines={1}>
          {deliveryAddress}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <View>
            <Text style={styles.amountLabel}>{t('orders.earnings_label', 'Earnings')}</Text>
            <Text style={styles.amountText}>{formatCurrency(earningsAmount)}</Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Package size={14} color={Colors.textLight} />
          <Text style={styles.infoText}>{itemCount} {t('orders.items', 'items')}</Text>
        </View>
        <View style={styles.infoItem}>
          <CreditCard size={14} color={order.isPaid ? Colors.success : Colors.accent} />
          <Text style={[styles.paymentText, { color: order.isPaid ? Colors.success : Colors.accent }]}>
            {order.isPaid ? t('order_detail.paid', 'Paid') : (order.paymentMethod ?? 'CASH')}
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
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

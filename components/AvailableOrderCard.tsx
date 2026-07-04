import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Navigation, Package, Clock, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { AvailableOrder } from '@/context/CourierContext';
import { formatCurrency, courierEarnings } from '@/lib/formatting';

interface AvailableOrderCardProps {
  order: AvailableOrder;
}

export const AvailableOrderCard = React.memo(function AvailableOrderCard({ order }: AvailableOrderCardProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const formatDistance = (km: number | undefined) => {
    const value = km ?? 0;
    if (value < 1) return `${(value * 1000).toFixed(0)} m`;
    return `${value.toFixed(1)} km`;
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return t('orders.just_now', 'Just now');
    if (diffMinutes < 60) return t('orders.minutes_ago', { count: diffMinutes, defaultValue: `${diffMinutes} min ago` });
    const diffHours = Math.floor(diffMinutes / 60);
    return t('orders.hours_ago', { count: diffHours, defaultValue: `${diffHours}h ago` });
  };

  const handlePress = () => {
    router.push(`/available-order/${order.orderId}`);
  };

  // Courier-facing offer amount: delivery fee + tip (shared helper)
  const estimatedEarnings = courierEarnings(order);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>{order.externalOrderNo}</Text>
          <View style={styles.timeBadge}>
            <Clock size={12} color={Colors.textLight} />
            <Text style={styles.timeText}>{formatTime(order.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.earningsBadge}>
          <Text style={styles.earningsText}>{formatCurrency(estimatedEarnings)}</Text>
        </View>
      </View>

      <View style={styles.locationSection}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: Colors.primary }]} />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>{t('orders.pickup', 'Pickup')}</Text>
            <Text style={styles.locationName} numberOfLines={1}>{order.restaurantName}</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>{order.restaurantAddress}</Text>
            {order.pickupDistance !== undefined && (
              <Text style={styles.distanceText}>{formatDistance(order.pickupDistance)} {t('orders.away', 'away')}</Text>
            )}
          </View>
        </View>

        <View style={styles.connector} />

        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: Colors.danger }]} />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>{t('orders.delivery', 'Delivery')}</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>{order.deliveryAddress}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.statsRow}>
          {order.estimatedDistance !== undefined && (
            <View style={styles.stat}>
              <Navigation size={14} color={Colors.textLight} />
              <Text style={styles.statText}>{formatDistance(order.estimatedDistance)}</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Package size={14} color={Colors.textLight} />
            <Text style={styles.statText}>{order.itemCount ?? 0} {t('orders.items', 'items')}</Text>
          </View>
        </View>

        <ChevronRight size={24} color={Colors.textLight} />
      </View>
    </TouchableOpacity>
  );
});

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
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  earningsBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  earningsText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  locationSection: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  connector: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 4,
    marginVertical: 4,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
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
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

export default AvailableOrderCard;

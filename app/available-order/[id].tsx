import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MapPin,
  Package,
  DollarSign,
  Navigation,
  Store,
  User,
  Phone,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier } from '@/context/CourierContext';
import { SlideButton } from '@/components/SlideButton';
import OrderMap from '@/components/OrderMap';

export default function AvailableOrderDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    availableOrders,
    acceptOrder,
    orderTakenEvent,
    clearOrderTakenEvent,
    fetchAvailableOrders,
    currentLocation,
    courierProfile,
  } = useCourier();
  const orderId = Number(id);

  // Get order from context - no API call needed
  const order = availableOrders.find(o => o.orderId === orderId);

  const [isAccepting, setIsAccepting] = React.useState(false);

  // Watch for ORDER_TAKEN event for this specific order. The backend
  // broadcasts ORDER_TAKEN for OUR OWN accept too — ignore events carrying
  // our courierId (and anything arriving while our accept is in flight),
  // otherwise the courier who just accepted sees "taken by another courier".
  React.useEffect(() => {
    if (orderTakenEvent && orderTakenEvent.orderId === orderId) {
      const myCourierId = courierProfile?.id;
      if (isAccepting || (myCourierId != null && Number(orderTakenEvent.courierId) === Number(myCourierId))) {
        clearOrderTakenEvent();
        return;
      }
      const courierName = orderTakenEvent.courierName || t('available_orders.another_courier');
      Alert.alert(
        t('available_orders.order_taken_title', 'Order No Longer Available'),
        t('available_orders.order_taken_message', 'This order was taken by {{courierName}}', { courierName }),
        [
          {
            text: t('common.ok', 'OK'),
            onPress: () => {
              clearOrderTakenEvent();
              router.back();
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, [orderTakenEvent, orderId, isAccepting, courierProfile, clearOrderTakenEvent, router, t]);

  const formatCurrency = (amount: number | undefined) => {
    return `${((amount ?? 0)).toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  const formatDistance = (km: number | undefined) => {
    const value = km ?? 0;
    if (value < 1) {
      return `${(value * 1000).toFixed(0)} m`;
    }
    return `${value.toFixed(1)} km`;
  };

  const handleAcceptOrder = async () => {
    if (!order) return;

    setIsAccepting(true);
    try {
      // Use context's acceptOrder which handles state properly
      await acceptOrder(order.orderId);
      // Navigate directly to map navigation screen
      router.replace(`/map-navigation/${order.orderId}`);
    } catch (error: any) {
      setIsAccepting(false);
      const errorMessage = error.message || '';

      // Check if the order was already taken by another courier
      if (
        errorMessage.includes('already has a courier assigned') ||
        errorMessage.includes('already assigned') ||
        errorMessage.includes('ORDER_TAKEN') ||
        errorMessage.includes('no longer available')
      ) {
        Alert.alert(
          t('available_orders.order_taken_title', 'Order No Longer Available'),
          t('available_orders.order_already_taken', 'This order was already taken by another courier.'),
          [
            {
              text: t('common.ok', 'OK'),
              onPress: () => {
                // Refresh available orders and go back
                fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), errorMessage || t('available_orders.accept_error'));
      }
    }
  };

  if (!order) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.notFoundText}>{t('order_detail.not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Use flat structure from backend response
  const restaurantName = order.restaurantName ?? '-';
  const restaurantAddress = order.restaurantAddress ?? '-';
  const deliveryAddr = order.deliveryAddress ?? '-';
  const customerName = order.customerName ?? '-';
  const customerPhone = order.customerPhone ?? null;
  const orderNumber = order.externalOrderNo ?? '-';
  const deliveryInstructions = order.deliveryInstructions ?? null;
  const earnings = (order.deliveryFee ?? 0) + (order.tipAmount ?? 0);

  // Create a minimal order object for the map
  const mapOrder = {
    orderId: order.orderId,
    restaurantLat: order.restaurantLat ?? 0,
    restaurantLng: order.restaurantLng ?? 0,
    deliveryLat: order.deliveryLat ?? 0,
    deliveryLng: order.deliveryLng ?? 0,
    restaurantName,
    customerName,
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{orderNumber}</Text>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>{t('available_orders.new_order')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <OrderMap order={mapOrder as any} showUserLocation={true} />
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View style={styles.earningStat}>
              <DollarSign size={24} color={Colors.success} />
              <View>
                <Text style={styles.earningValue}>{formatCurrency(earnings)}</Text>
                <Text style={styles.earningLabel}>{t('available_orders.estimated_earnings')}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.earningStat}>
              <Package size={24} color={Colors.primary} />
              <View>
                <Text style={styles.earningValue}>{order.itemCount ?? 0}</Text>
                <Text style={styles.earningLabel}>{t('available_orders.items')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Route Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('available_orders.route_details')}</Text>

          {/* Pickup Location */}
          <View style={styles.locationSection}>
            <View style={styles.locationHeader}>
              <View style={[styles.locationIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Store size={20} color={Colors.primary} />
              </View>
              <View style={[styles.locationBadge, { backgroundColor: Colors.primary }]}>
                <Text style={styles.locationBadgeText}>A</Text>
              </View>
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>{t('available_orders.pickup')}</Text>
              <Text style={styles.locationName}>{restaurantName}</Text>
              <Text style={styles.locationAddress}>{restaurantAddress}</Text>
            </View>
          </View>

          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeDot} />
            <View style={styles.routeDot} />
          </View>

          {/* Dropoff Location */}
          <View style={styles.locationSection}>
            <View style={styles.locationHeader}>
              <View style={[styles.locationIcon, { backgroundColor: Colors.accent + '20' }]}>
                <User size={20} color={Colors.accent} />
              </View>
              <View style={[styles.locationBadge, { backgroundColor: Colors.accent }]}>
                <Text style={styles.locationBadgeText}>B</Text>
              </View>
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>{t('available_orders.dropoff')}</Text>
              <Text style={styles.locationName}>{customerName}</Text>
              <Text style={styles.locationAddress}>{deliveryAddr}</Text>
              {!!customerPhone && (
                <View style={styles.phoneRow}>
                  <Phone size={14} color={Colors.primary} />
                  <Text style={styles.phoneText}>{customerPhone}</Text>
                </View>
              )}
              {!!deliveryInstructions && (
                <Text style={styles.instructionsText}>{deliveryInstructions}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Tip Info */}
        {(order.tipAmount ?? 0) > 0 && (
          <View style={styles.tipCard}>
            <DollarSign size={20} color={Colors.success} />
            <Text style={styles.tipText}>
              {t('available_orders.tip')}: {formatCurrency(order.tipAmount)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer with Slide to Accept */}
      <View style={styles.footer}>
        {isAccepting ? (
          <View style={styles.acceptingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.acceptingText}>{t('available_orders.accepting')}</Text>
          </View>
        ) : (
          <SlideButton
            title={t('available_orders.slide_to_accept')}
            onComplete={handleAcceptOrder}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backLink: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backLinkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  newBadge: {
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mapContainer: {
    height: 250,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginBottom: 8,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  earningValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  earningLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationHeader: {
    alignItems: 'center',
    marginRight: 16,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.surface,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  phoneText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  instructionsText: {
    fontSize: 13,
    color: Colors.accent,
    fontStyle: 'italic',
    marginTop: 8,
  },
  routeLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
    paddingLeft: 60,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  tipCard: {
    backgroundColor: Colors.success + '15',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  acceptingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  acceptingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});

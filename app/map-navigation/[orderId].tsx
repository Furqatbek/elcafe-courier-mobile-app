import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Navigation as NavigationIcon, RefreshCw, Clock, MapPin, Phone, Store, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier, OrderStatus } from '@/context/CourierContext';
import OrderMap from '@/components/OrderMap';
import { SlideButton } from '@/components/SlideButton';
import { RouteInfo } from '@/lib/routing';
import * as Location from 'expo-location';

export default function MapNavigationScreen() {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, completeOrder, refreshOrders } = useCourier();
  const insets = useSafeAreaInsets();

  const numericOrderId = Number(orderId);
  const [order, setOrder] = useState(orders.find(o => o.orderId === numericOrderId));
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [recalculateTrigger, setRecalculateTrigger] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Keep order in sync with context
  useEffect(() => {
    const updatedOrder = orders.find(o => o.orderId === numericOrderId);
    if (updatedOrder) {
      setOrder(updatedOrder);
    }
  }, [orders, numericOrderId]);

  // Fetch order if not found
  useEffect(() => {
    if (!order) {
      refreshOrders();
    }
  }, []);

  const handleRouteUpdate = useCallback((info: RouteInfo) => {
    setRouteInfo(info);
  }, []);

  const handleRecalculate = useCallback(() => {
    setRecalculateTrigger(prev => prev + 1);
  }, []);

  // Get next status based on current status
  const getNextStatus = (): OrderStatus | null => {
    if (!order) return null;
    switch (order.status) {
      case 'ACCEPTED': return 'PICKED_UP';
      case 'PICKED_UP': return 'DELIVERING';
      case 'DELIVERING': return 'DELIVERED';
      default: return null;
    }
  };

  // Get slide button title based on current status
  const getSlideTitle = (): string => {
    if (!order) return '';
    switch (order.status) {
      case 'ACCEPTED': return t('navigation.slide_picked_up');
      case 'PICKED_UP': return t('navigation.slide_start_delivery');
      case 'DELIVERING': return t('navigation.slide_delivered');
      default: return t('order_detail.order_completed');
    }
  };

  // Get current destination info
  const getDestinationInfo = () => {
    if (!order) return { label: '', address: '', name: '', phone: '' };

    const isGoingToRestaurant = order.status === 'ACCEPTED';

    return {
      label: isGoingToRestaurant ? t('navigation.heading_to_pickup') : t('navigation.heading_to_dropoff'),
      address: isGoingToRestaurant
        ? (order.restaurantAddress ?? '-')
        : (order.deliveryAddress ?? '-'),
      name: isGoingToRestaurant
        ? (order.restaurantName ?? '-')
        : (order.customerName ?? '-'),
      phone: order.customerPhone ?? null,
      icon: isGoingToRestaurant ? Store : User,
      color: isGoingToRestaurant ? Colors.primary : Colors.accent,
    };
  };

  const handleSlideComplete = async () => {
    if (!order || isUpdatingStatus) return;

    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    setIsUpdatingStatus(true);
    try {
      if (nextStatus === 'DELIVERED') {
        // Complete the order
        const result = await completeOrder(order.orderId);
        if (result) {
          Alert.alert(
            t('order_detail.delivery_complete'),
            t('order_detail.earned_amount', { amount: formatCurrency(result.earnings) }),
            [{ text: t('common.ok'), onPress: () => router.replace(`/order-rating/${order.orderId}`) }]
          );
        }
      } else {
        // Update to next status
        await updateOrderStatus(order.orderId, nextStatus);
        // Recalculate route for new destination
        if (nextStatus === 'PICKED_UP') {
          handleRecalculate();
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('order_detail.status_update_failed'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCall = () => {
    const dest = getDestinationInfo();
    if (dest.phone) {
      Linking.openURL(`tel:${dest.phone}`);
    } else {
      Alert.alert(t('order_detail.call'), t('order_detail.no_phone'));
    }
  };

  const handleOpenExternalNav = () => {
    if (!order) return;

    const isGoingToRestaurant = order.status === 'ACCEPTED';
    const lat = isGoingToRestaurant ? order.restaurantLat : order.deliveryLat;
    const lng = isGoingToRestaurant ? order.restaurantLng : order.deliveryLng;

    if (!lat || !lng) return;

    const scheme = Platform.select({ ios: 'maps:', android: 'geo:' });
    const url = Platform.select({
      ios: `maps:?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      });
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} ${t('common.min')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} ${t('common.hour')} ${mins} ${t('common.min')}`;
  };

  const formatCurrency = (amount: number) => {
    return `${(amount ?? 0).toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { top: insets.top + 10 }]}>
           <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>{t('order_detail.not_found')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check if delivery is complete
  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={styles.completedText}>
            {order.status === 'DELIVERED' ? t('navigation.delivery_completed') : t('navigation.order_cancelled')}
          </Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/orders')} style={styles.backLink}>
            <Text style={styles.backLinkText}>{t('navigation.back_to_orders')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const destination = getDestinationInfo();
  const DestIcon = destination.icon;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Map takes full screen */}
      <View style={styles.mapContainer}>
        <OrderMap
          order={order}
          navigationMode={true}
          onRouteUpdate={handleRouteUpdate}
          recalculateTrigger={recalculateTrigger}
        />
      </View>

      {/* Floating Header */}
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>

        <View style={[styles.statusBadge, { backgroundColor: destination.color + '20' }]}>
          <DestIcon size={16} color={destination.color} />
          <Text style={[styles.statusText, { color: destination.color }]}>
            {destination.label}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleRecalculate}
          style={styles.actionButton}
        >
          <RefreshCw color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Route Info Banner */}
      {routeInfo && (
        <View style={[styles.routeBanner, { top: insets.top + 70 }]}>
          <View style={styles.routeBannerItem}>
            <Clock size={18} color={Colors.primary} />
            <Text style={styles.routeBannerValue}>{formatDuration(routeInfo.duration)}</Text>
          </View>
          <View style={styles.routeBannerDivider} />
          <View style={styles.routeBannerItem}>
            <MapPin size={18} color={Colors.primary} />
            <Text style={styles.routeBannerValue}>{formatDistance(routeInfo.distance)}</Text>
          </View>
        </View>
      )}

      {/* Bottom Info Card */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
        {/* Destination Info */}
        <View style={styles.destinationSection}>
          <View style={[styles.destinationIcon, { backgroundColor: destination.color + '15' }]}>
            <DestIcon size={24} color={destination.color} />
          </View>
          <View style={styles.destinationContent}>
            <Text style={styles.destinationName}>{destination.name}</Text>
            <Text style={styles.destinationAddress} numberOfLines={2}>{destination.address}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.smallActionButton} onPress={handleCall}>
              <Phone size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallActionButton} onPress={handleOpenExternalNav}>
              <NavigationIcon size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <Text style={styles.progressLabel}>{t('navigation.accepted')}</Text>
          </View>
          <View style={[styles.progressLine, order.status !== 'ACCEPTED' && styles.progressLineCompleted]} />
          <View style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              (order.status === 'PICKED_UP' || order.status === 'DELIVERING') && styles.progressDotCompleted
            ]} />
            <Text style={styles.progressLabel}>{t('navigation.picked_up')}</Text>
          </View>
          <View style={[styles.progressLine, order.status === 'DELIVERING' && styles.progressLineCompleted]} />
          <View style={styles.progressStep}>
            <View style={styles.progressDot} />
            <Text style={styles.progressLabel}>{t('navigation.delivered')}</Text>
          </View>
        </View>

        {/* Slide Button */}
        <View style={styles.slideContainer}>
          <SlideButton
            title={getSlideTitle()}
            onComplete={handleSlideComplete}
            disabled={isUpdatingStatus}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  completedText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
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
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  routeBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9,
  },
  routeBannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBannerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  routeBannerDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 24,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  destinationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  destinationIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  destinationContent: {
    flex: 1,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  smallActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
    marginBottom: 6,
  },
  progressDotCompleted: {
    backgroundColor: Colors.success,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
    marginBottom: 20,
  },
  progressLineCompleted: {
    backgroundColor: Colors.success,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  slideContainer: {
    marginTop: 4,
  },
});

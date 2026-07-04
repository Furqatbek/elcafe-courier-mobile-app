import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Navigation as NavigationIcon, Clock, MapPin, Phone, Store, User, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier, OrderStatus } from '@/context/CourierContext';
import OrderMap from '@/components/OrderMap';
import { SlideButton } from '@/components/SlideButton';
import { RouteInfo } from '@/lib/routing';

export default function MapNavigationScreen() {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, completeOrder, refreshData } = useCourier();
  const insets = useSafeAreaInsets();

  const numericOrderId = Number(orderId);
  const [order, setOrder] = useState(orders.find(o => o.orderId === numericOrderId));
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [recalculateTrigger, setRecalculateTrigger] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [hasOpenedNavigation, setHasOpenedNavigation] = useState(false);

  // Keep order in sync with context
  useEffect(() => {
    const updatedOrder = orders.find(o => Number(o.orderId) === numericOrderId);
    console.log('[MapNavigation] Syncing order from context:', {
      orderId: numericOrderId,
      ordersCount: orders.length,
      orderIds: orders.map(o => o.orderId),
      found: !!updatedOrder,
      status: updatedOrder?.status,
      previousStatus: order?.status
    });
    if (updatedOrder && updatedOrder.status !== order?.status) {
      console.log('[MapNavigation] Status changed! Updating local order state');
      setOrder(updatedOrder);
    } else if (updatedOrder && !order) {
      console.log('[MapNavigation] Initial order set');
      setOrder(updatedOrder);
    }
  }, [orders, numericOrderId]);

  // Fetch order if not found
  useEffect(() => {
    if (!order) {
      refreshData();
    }
  }, []);

  // Determine current destination based on order status
  // Going to pickup if status is ACCEPTED or READY
  const isGoingToPickup = order?.status === 'COURIER_ASSIGNED' || order?.status === 'READY';
  // Pickup is blocked server-side until the restaurant marks the order READY
  const isOrderReady = !!order?.readyAt || order?.status === 'READY';

  // Auto-open navigation when screen loads or status changes
  useEffect(() => {
    if (order && !hasOpenedNavigation) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        console.log('[MapNavigation] Auto-opening navigation to:', isGoingToPickup ? 'pickup' : 'dropoff');
        openExternalNavigation();
        setHasOpenedNavigation(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [order?.orderId, hasOpenedNavigation, order?.status]);

  // Reset navigation flag when status changes to IN_TRANSIT (to trigger new navigation to customer)
  useEffect(() => {
    if (order?.status === 'IN_TRANSIT' || order?.status === 'PICKED_UP') {
      console.log('[MapNavigation] Status changed to', order?.status, ', resetting navigation flag');
      setHasOpenedNavigation(false); // Reset to trigger navigation to customer
    }
  }, [order?.status]);

  const handleRouteUpdate = useCallback((info: RouteInfo) => {
    setRouteInfo(info);
  }, []);

  // Handle back navigation with fallback
  const handleBack = useCallback(() => {
    console.log('[MapNavigation] Back button pressed');
    // On web, router.back() might not work if there's no history
    // Use replace to go to orders page as fallback
    if (Platform.OS === 'web') {
      router.replace('/(tabs)/orders');
    } else {
      router.back();
    }
  }, [router]);

  // Get destination info based on current status
  const getDestinationInfo = () => {
    if (!order) return { label: '', address: '', name: '', phone: '', lat: 0, lng: 0 };

    if (isGoingToPickup) {
      return {
        label: t('navigation.heading_to_pickup'),
        address: order.restaurantAddress ?? '-',
        name: order.restaurantName ?? '-',
        phone: null,
        icon: Store,
        color: Colors.primary,
        lat: order.restaurantLat,
        lng: order.restaurantLng,
      };
    } else {
      return {
        label: t('navigation.heading_to_dropoff'),
        address: order.deliveryAddress ?? '-',
        name: order.customerName ?? '-',
        phone: order.customerPhone ?? null,
        icon: User,
        color: Colors.accent,
        lat: order.deliveryLat,
        lng: order.deliveryLng,
      };
    }
  };

  // Open external navigation app (Google Maps, Apple Maps, Waze)
  const openExternalNavigation = () => {
    const dest = getDestinationInfo();
    const lat = dest.lat;
    const lng = dest.lng;
    const hasCoords = lat != null && lng != null && (lat !== 0 || lng !== 0);
    const label = encodeURIComponent(dest.name);
    const destination = hasCoords
      ? `${lat},${lng}`
      : encodeURIComponent(dest.address || dest.name);

    if (!hasCoords && !dest.address) return;

    const navigationUrls = hasCoords
      ? Platform.select({
          ios: [
            `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
            `waze://?ll=${lat},${lng}&navigate=yes`,
            `maps://?daddr=${lat},${lng}`,
          ],
          android: [
            `google.navigation:q=${lat},${lng}`,
            `waze://?ll=${lat},${lng}&navigate=yes`,
            `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
          ],
          default: [
            `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
          ],
        }) || []
      : Platform.select({
          ios: [
            `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
            `maps://?daddr=${destination}`,
          ],
          android: [
            `geo:0,0?q=${destination}`,
          ],
          default: [
            `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
          ],
        }) || [];

    const tryOpenUrl = async (urls: string[], index: number = 0) => {
      if (index >= urls.length) {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`);
        return;
      }
      try {
        const supported = await Linking.canOpenURL(urls[index]);
        if (supported) {
          await Linking.openURL(urls[index]);
        } else {
          tryOpenUrl(urls, index + 1);
        }
      } catch {
        tryOpenUrl(urls, index + 1);
      }
    };

    tryOpenUrl(navigationUrls);
  };

  // Handle pickup confirmation
  const handlePickupComplete = async () => {
    if (!order || isUpdatingStatus) return;

    console.log('[MapNavigation] Handling pickup complete for order:', order.orderId);
    setIsUpdatingStatus(true);
    try {
      // Mark as picked up - backend handles status transition
      await updateOrderStatus(order.orderId, 'PICKED_UP');
      console.log('[MapNavigation] Status updated to PICKED_UP, triggering route recalculation');

      // Trigger route recalculation for new destination
      setRecalculateTrigger(prev => prev + 1);
      // Note: hasOpenedNavigation is reset by the useEffect watching order.status
    } catch (error: any) {
      console.error('[MapNavigation] Error updating pickup status:', error);
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('not ready for pickup')) {
        Alert.alert(
          t('order_detail.not_ready_title'),
          t('order_detail.not_ready_message')
        );
      } else {
        Alert.alert(t('common.error'), msg || t('order_detail.status_update_failed'));
      }
      throw error;
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle delivery completion
  const handleDeliveryComplete = async () => {
    if (!order || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      const result = await completeOrder(order.orderId);
      if (result) {
        Alert.alert(
          t('order_detail.delivery_complete'),
          t('order_detail.earned_amount', { amount: formatCurrency(result.earnings) }),
          [{ text: t('common.ok'), onPress: () => router.replace(`/order-rating/${order.orderId}`) }]
        );
      }
    } catch (error) {
      console.error('[MapNavigation] handleDeliveryComplete error:', error);
      Alert.alert(t('common.error'), t('order_detail.status_update_failed'));
      throw error; // Re-throw so SlideButton resets
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>{t('order_detail.not_found')}</Text>
          <TouchableOpacity onPress={handleBack} style={styles.backLink}>
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
          <TouchableOpacity onPress={handleBack} style={styles.backLink}>
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

      {/* Map preview in background */}
      <View style={styles.mapContainer}>
        <OrderMap
          order={order}
          navigationMode={true}
          showUserLocation={true}
          onRouteUpdate={handleRouteUpdate}
          recalculateTrigger={recalculateTrigger}
        />
      </View>

      {/* Floating back button */}
      <View style={[styles.headerLeft, { top: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Status badge */}
      <View style={[styles.headerCenter, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={[styles.statusBadge, { backgroundColor: destination.color + '20' }]}>
          <DestIcon size={16} color={destination.color} />
          <Text style={[styles.statusText, { color: destination.color }]}>
            {destination.label}
          </Text>
        </View>
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

      {/* Bottom card with destination info and slide button */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
        {/* Destination Info */}
        <View style={styles.destinationInfo}>
          <View style={[styles.destinationIcon, { backgroundColor: destination.color + '15' }]}>
            <DestIcon size={24} color={destination.color} />
          </View>
          <View style={styles.destinationContent}>
            <Text style={styles.destinationLabel}>
              {isGoingToPickup ? t('navigation.heading_to_pickup') : t('navigation.delivering_to')}
            </Text>
            <Text style={styles.destinationName}>{destination.name}</Text>
            <Text style={styles.destinationAddress} numberOfLines={2}>
              {destination.address}
            </Text>
          </View>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionRow}>
          {destination.phone && (
            <TouchableOpacity style={styles.actionButtonSmall} onPress={handleCall}>
              <Phone size={20} color={Colors.text} />
              <Text style={styles.actionButtonText}>{t('order_detail.call')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButtonLarge, { backgroundColor: destination.color }]}
            onPress={openExternalNavigation}
          >
            <NavigationIcon size={22} color={Colors.surface} />
            <Text style={styles.actionButtonLargeText}>{t('navigation.open_navigator')}</Text>
            <ExternalLink size={16} color={Colors.surface} />
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotCompleted]} />
            <Text style={styles.progressLabel}>{t('navigation.accepted')}</Text>
          </View>
          <View style={[styles.progressLine, !isGoingToPickup && styles.progressLineCompleted]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, !isGoingToPickup && styles.progressDotCompleted]} />
            <Text style={styles.progressLabel}>{t('navigation.picked_up')}</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={styles.progressDot} />
            <Text style={styles.progressLabel}>{t('navigation.delivered')}</Text>
          </View>
        </View>

        {/* Slide button - changes based on status */}
        <View style={styles.slideContainer}>
          {isGoingToPickup ? (
            <SlideButton
              key={`pickup-${order.status}-${order.orderId}`}
              title={isOrderReady ? t('navigation.slide_picked_up') : t('order_detail.slide_pickup_waiting')}
              onComplete={handlePickupComplete}
              isLoading={isUpdatingStatus}
              disabled={!isOrderReady}
            />
          ) : (
            <SlideButton
              key={`delivery-${order.status}-${order.orderId}`}
              title={t('navigation.slide_delivered')}
              onComplete={handleDeliveryComplete}
              isLoading={isUpdatingStatus}
            />
          )}
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
  headerLeft: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
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
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  destinationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  actionButtonLargeText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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

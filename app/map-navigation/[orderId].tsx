import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Navigation as NavigationIcon, Clock, MapPin, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier } from '@/context/CourierContext';
import OrderMap from '@/components/OrderMap';
import { SlideButton } from '@/components/SlideButton';
import { RouteInfo } from '@/lib/routing';
import * as Location from 'expo-location';

export default function MapNavigationScreen() {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, completeOrder, refreshOrders } = useCourier();
  const insets = useSafeAreaInsets();

  const numericOrderId = Number(orderId);
  const [order, setOrder] = useState(orders.find(o => o.orderId === numericOrderId));
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

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

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    setCurrentLocation(location);
  }, []);

  const handleSlideComplete = async () => {
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
      Alert.alert(t('common.error'), t('order_detail.status_update_failed'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCallCustomer = () => {
    if (order?.customerPhone) {
      Linking.openURL(`tel:${order.customerPhone}`);
    } else {
      Alert.alert(t('order_detail.call'), t('order_detail.no_phone'));
    }
  };

  const handleOpenExternalNav = () => {
    if (!order) return;

    const lat = order.deliveryLat;
    const lng = order.deliveryLng;

    if (!lat || !lng) return;

    const url = Platform.select({
      ios: `maps:?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Full screen map with real-time location */}
      <View style={styles.mapContainer}>
        <OrderMap
          order={order}
          navigationMode={true}
          showUserLocation={true}
          onRouteUpdate={handleRouteUpdate}
          onLocationUpdate={handleLocationUpdate}
        />
      </View>

      {/* Floating back button */}
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Route Info Banner */}
      {routeInfo && (
        <View style={[styles.routeBanner, { top: insets.top + 10 }]}>
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

      {/* Bottom card with delivery info and slide button */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
        {/* Delivery Address */}
        <View style={styles.deliveryInfo}>
          <View style={styles.deliveryContent}>
            <Text style={styles.deliveryLabel}>{t('navigation.delivering_to')}</Text>
            <Text style={styles.customerName}>{order.customerName ?? '-'}</Text>
            <Text style={styles.deliveryAddress} numberOfLines={2}>
              {order.deliveryAddress ?? '-'}
            </Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCallCustomer}>
              <Phone size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleOpenExternalNav}>
              <NavigationIcon size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Slide to deliver button */}
        <View style={styles.slideContainer}>
          <SlideButton
            title={t('navigation.slide_delivered')}
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
  routeBanner: {
    position: 'absolute',
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    gap: 6,
  },
  routeBannerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  routeBannerDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
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
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  deliveryAddress: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContainer: {
    marginTop: 8,
  },
});

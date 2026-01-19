import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  Package,
  ChevronRight,
  RefreshCw,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { api, AvailableOrder } from '@/services/api';
import { useCourier } from '@/context/CourierContext';
import { EmptyState } from '@/components/EmptyState';

export default function AvailableOrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { courierProfile, isOnline } = useCourier();

  const [orders, setOrders] = useState<AvailableOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error(t('available_orders.location_permission_required'));
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(coords);
      return coords;
    } catch (error) {
      console.error('Failed to get location:', error);
      return null;
    }
  }, [toast, t]);

  const fetchOrders = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let location = currentLocation;
      if (!location) {
        location = await fetchLocation();
      }

      const radius = courierProfile?.preferredRadiusKm || DEFAULTS.DEFAULT_RADIUS_KM;
      const data = await api.orders.getAvailableOrders(
        location?.latitude,
        location?.longitude,
        radius
      );
      setOrders(data);
    } catch (error: any) {
      if (!showRefreshing) {
        toast.error(error.message || t('available_orders.fetch_error'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentLocation, courierProfile, fetchLocation, toast, t]);

  useEffect(() => {
    if (isOnline) {
      fetchOrders();
    }
  }, [isOnline]);

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await api.orders.acceptOrder(orderId);
      toast.success(t('available_orders.order_accepted'));
      router.push(`/order/${orderId}`);
    } catch (error: any) {
      toast.error(error.message || t('available_orders.accept_error'));
    }
  };

  const formatCurrency = (amount: number) => {
    return `${(amount / 1000).toFixed(0)}k ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  const formatDistance = (km: number) => {
    if (km < 1) {
      return `${(km * 1000).toFixed(0)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const renderOrderItem = ({ item }: { item: AvailableOrder }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleAcceptOrder(item.orderId)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <View style={styles.itemCountBadge}>
            <Package size={12} color={Colors.textSecondary} />
            <Text style={styles.itemCount}>{item.itemCount} items</Text>
          </View>
        </View>
        <View style={styles.earningsContainer}>
          <DollarSign size={16} color={Colors.success} />
          <Text style={styles.earnings}>{formatCurrency(item.estimatedEarnings)}</Text>
        </View>
      </View>

      <View style={styles.locationSection}>
        {/* Pickup */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: Colors.primary }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>{t('available_orders.pickup')}</Text>
            <Text style={styles.locationName}>{item.restaurant.name}</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {item.restaurant.address}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {formatDistance(item.restaurant.distance || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.locationLine} />

        {/* Dropoff */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: Colors.accent }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>{t('available_orders.dropoff')}</Text>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {item.deliveryAddress.fullAddress}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {formatDistance(item.deliveryAddress.distance || 0)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.totalDistance}>
          <Navigation size={14} color={Colors.textSecondary} />
          <Text style={styles.totalDistanceText}>
            {t('available_orders.total_distance')}: {formatDistance(item.estimatedDistance)}
          </Text>
        </View>
        <View style={styles.acceptButton}>
          <Text style={styles.acceptButtonText}>{t('available_orders.accept')}</Text>
          <ChevronRight size={18} color={Colors.surface} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!isOnline) {
    return (
      <>
        <Stack.Screen options={{ title: t('available_orders.title') }} />
        <View style={styles.offlineContainer}>
          <EmptyState
            icon={<MapPin size={48} color={Colors.textLight} />}
            title={t('available_orders.offline_title')}
            message={t('available_orders.offline_message')}
            actionLabel={t('available_orders.go_online')}
            onAction={() => router.back()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('available_orders.title'),
          headerRight: () => (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => fetchOrders(true)}
              disabled={isRefreshing}
            >
              <RefreshCw
                size={20}
                color={isRefreshing ? Colors.textLight : Colors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('available_orders.loading')}</Text>
          </View>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package size={48} color={Colors.textLight} />}
            title={t('available_orders.no_orders_title')}
            message={t('available_orders.no_orders_message')}
            actionLabel={t('available_orders.refresh')}
            onAction={() => fetchOrders(true)}
          />
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.orderId.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchOrders(true)}
                tintColor={Colors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  offlineContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 16,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumberContainer: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  earningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  earnings: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.success,
  },
  locationSection: {
    position: 'relative',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  locationLine: {
    position: 'absolute',
    left: 5,
    top: 28,
    bottom: 28,
    width: 2,
    backgroundColor: Colors.border,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  distanceBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalDistanceText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
});

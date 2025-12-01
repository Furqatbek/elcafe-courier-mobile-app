import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Navigation as NavigationIcon, RefreshCw, Clock, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';
import OrderMap from '@/components/OrderMap';
import { trpcClient } from '@/lib/trpc';
import { RouteInfo } from '@/lib/routing';
import { Button } from '@/components/Button';
import * as Location from 'expo-location';

export default function MapNavigationScreen() {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders } = useCourier();
  const insets = useSafeAreaInsets();
  
  const [order, setOrder] = useState(orders.find(o => o.id === orderId));
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [recalculateTrigger, setRecalculateTrigger] = useState(0);

  useEffect(() => {
    setOrder(orders.find(o => o.id === orderId));
  }, [orders, orderId]);

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { marginTop: insets.top }]}>
           <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text>{t('order_detail.not_found')}</Text>
        </View>
      </View>
    );
  }

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    try {
      await trpcClient.courier.updateLocation.mutate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
    } catch {
      console.error("Failed to update location");
    }
  };

  const handleRouteUpdate = (info: RouteInfo) => {
    setRouteInfo(info);
  };

  const handleStartNavigation = async () => {
    try {
      await trpcClient.courier.startNavigation.mutate({ orderId: order.id });
      setIsNavigating(true);
      // Recalculate route to ensure we have the latest
      setRecalculateTrigger(prev => prev + 1);
    } catch {
      Alert.alert(t('common.error'), "Failed to start navigation");
    }
  };

  const handleArrived = async () => {
    try {
      await trpcClient.courier.arrived.mutate({ orderId: order.id });
      setIsNavigating(false);
      Alert.alert(t('common.success'), t('order_detail.delivery_completed'), [
        { text: t('common.ok'), onPress: () => router.push('/(tabs)/orders') }
      ]);
    } catch {
      Alert.alert(t('common.error'), "Failed to report arrival");
    }
  };

  const handleRecalculate = () => {
    setRecalculateTrigger(prev => prev + 1);
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} h ${mins} min`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Map takes full screen */}
      <View style={styles.mapContainer}>
        <OrderMap 
          order={order} 
          navigationMode={isNavigating} // Always track, but logic changes if navigating
          onLocationUpdate={handleLocationUpdate}
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
        
        {!isNavigating && (
          <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{t('order_detail.navigation')}</Text>
          </View>
        )}

        <TouchableOpacity 
          onPress={handleRecalculate}
          style={styles.actionButton}
        >
          <RefreshCw color={Colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {/* Top Instruction Banner (only when navigating) */}
      {isNavigating && routeInfo && routeInfo.steps.length > 0 && (
         <View style={[styles.instructionBanner, { top: insets.top + 70 }]}>
            <View style={styles.instructionIcon}>
                <NavigationIcon size={32} color={Colors.surface} />
            </View>
            <View style={styles.instructionContent}>
                <Text style={styles.instructionText}>
                    {routeInfo.steps[0].instruction || "Follow route"}
                </Text>
                <Text style={styles.instructionSubText}>
                    {formatDistance(routeInfo.steps[0].distance)}
                </Text>
            </View>
         </View>
      )}

      {/* Bottom Info Card */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
        {routeInfo && (
          <View style={styles.routeInfo}>
            <View style={styles.routeStat}>
              <Clock size={20} color={Colors.primary} />
              <View>
                <Text style={styles.statValue}>{formatDuration(routeInfo.duration)}</Text>
                <Text style={styles.statLabel}>{t('order_detail.estimated_arrival')}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.routeStat}>
              <MapPin size={20} color={Colors.primary} />
              <View>
                <Text style={styles.statValue}>{formatDistance(routeInfo.distance)}</Text>
                <Text style={styles.statLabel}>{t('order_detail.distance')}</Text>
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>
              {order.status === 'pickup' ? t('order_detail.pickup_label') : t('order_detail.dropoff_label')}
            </Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {order.status === 'pickup' ? order.restaurantAddress : order.customerAddress}
            </Text>
        </View>

        <View style={styles.actionsContainer}>
            {!isNavigating ? (
                <Button 
                    title={t('order_detail.start_navigation')} 
                    onPress={handleStartNavigation}
                    variant="primary"
                    style={{ flex: 1 }}
                />
            ) : (
                <View style={styles.navButtons}>
                    <Button 
                        title={t('order_detail.recalculate')} 
                        onPress={handleRecalculate}
                        variant="secondary"
                        style={{ flex: 1 }}
                    />
                    <View style={{ width: 16 }} />
                    <Button 
                        title={t('order_detail.arrived')} 
                        onPress={handleArrived}
                        variant="primary"
                        style={{ flex: 1, backgroundColor: Colors.success }}
                    />
                </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitleContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  instructionBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9,
  },
  instructionIcon: {
    marginRight: 16,
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.surface,
    marginBottom: 4,
  },
  instructionSubText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
  },
  actionsContainer: {
    marginTop: 0,
  },
  navButtons: {
    flexDirection: 'row',
  },
});

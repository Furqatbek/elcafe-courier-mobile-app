import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Switch, ActivityIndicator, RefreshControl, Vibration, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell, Package } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useCourier, AvailableOrder, Order } from '@/context/CourierContext';
import { OrderCard } from '@/components/OrderCard';
import { AvailableOrderCard } from '@/components/AvailableOrderCard';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';
import { useToast } from '@/components/Toast';

const TAB_ROUTES = [
  { name: 'orders', path: '/(tabs)/orders' },
  { name: 'finance', path: '/(tabs)/finance' },
  { name: 'settings', path: '/(tabs)/settings' },
];

export default function OrdersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activeOrders,
    availableOrders,
    isLoadingAvailableOrders,
    fetchAvailableOrders,
    isOnline,
    toggleOnline,
    currentLocation,
    user,
    orderHistory,
    isLoadingHistory,
    historyPagination,
    fetchOrderHistory,
    loadMoreHistory,
    unreadCount,
    newOrderOffer,
    clearNewOrderOffer,
  } = useCourier();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  const [showNewOrderBanner, setShowNewOrderBanner] = useState(false);
  const [bannerOrder, setBannerOrder] = useState<AvailableOrder | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedRef = useRef(false);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect new orders from API fetches
  useEffect(() => {
    // Reset when going offline
    if (!isOnline) {
      previousOrderIdsRef.current = new Set();
      hasInitializedRef.current = false;
      return;
    }

    // Skip if no orders yet
    if (availableOrders.length === 0) {
      return;
    }

    const currentOrderIds = new Set(availableOrders.map(o => o.orderId));

    // First time seeing orders - just store them, don't notify
    if (!hasInitializedRef.current) {
      console.log('[Orders] Initial load, storing order IDs:', Array.from(currentOrderIds));
      previousOrderIdsRef.current = currentOrderIds;
      hasInitializedRef.current = true;
      return;
    }

    // Find new orders (in current but not in previous)
    const newOrders = availableOrders.filter(
      order => !previousOrderIdsRef.current.has(order.orderId)
    );

    console.log('[Orders] Checking for new orders:', {
      previous: Array.from(previousOrderIdsRef.current),
      current: Array.from(currentOrderIds),
      newOrders: newOrders.map(o => o.orderId),
      showingBanner: showNewOrderBanner
    });

    // Show notification for the first new order
    if (newOrders.length > 0 && !showNewOrderBanner) {
      const newestOrder = newOrders[0];
      console.log('[Orders] New order detected! Showing notification for:', newestOrder.orderId);
      triggerNotification(newestOrder);
    }

    // Update previous order IDs
    previousOrderIdsRef.current = currentOrderIds;
  }, [availableOrders, isOnline, showNewOrderBanner]);

  // Trigger notification for an order (from API or WebSocket)
  const triggerNotification = useCallback((order: AvailableOrder) => {
    // Clear any existing timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    if (pulseAnimationRef.current) {
      pulseAnimationRef.current.stop();
    }

    // Vibrate device
    Vibration.vibrate([0, 200, 100, 200]);

    // Set the order for the banner
    setBannerOrder(order);
    setShowNewOrderBanner(true);

    // Reset animation value and animate in
    bannerAnim.setValue(-100);
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Pulse animation for the banner
    pulseAnim.setValue(1);
    pulseAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current.start();

    // Auto-hide after 10 seconds
    hideTimerRef.current = setTimeout(() => {
      hideBanner();
    }, 10000);
  }, [bannerAnim, pulseAnim]);

  // Show notification when new order arrives via WebSocket
  useEffect(() => {
    if (newOrderOffer && isOnline && !showNewOrderBanner) {
      try {
        console.log('[Orders] *** v4 *** WebSocket new order notification:', newOrderOffer.orderId);
        console.log('[Orders] newOrderOffer keys:', Object.keys(newOrderOffer));
        console.log('[Orders] restaurantName:', newOrderOffer.restaurantName);
        // Convert WebSocket notification to AvailableOrder format for display
        // WebSocket now sends flat structure matching AvailableOrder
        const wsOrder: AvailableOrder = {
          orderId: newOrderOffer.orderId,
          externalOrderNo: newOrderOffer.externalOrderNo,
          restaurantId: newOrderOffer.restaurantId,
          restaurantName: newOrderOffer.restaurantName || 'Restaurant',
          restaurantAddress: newOrderOffer.restaurantAddress || '',
          restaurantLat: newOrderOffer.restaurantLat || 0,
          restaurantLng: newOrderOffer.restaurantLng || 0,
          deliveryAddress: newOrderOffer.deliveryAddress || '',
          deliveryLat: newOrderOffer.deliveryLat || 0,
          deliveryLng: newOrderOffer.deliveryLng || 0,
          customerName: '',
          customerPhone: '',
          status: 'READY',
          deliveryFee: newOrderOffer.deliveryFee || 0,
          tipAmount: newOrderOffer.tipAmount || 0,
          total: newOrderOffer.total || newOrderOffer.deliveryFee || 0,
          itemCount: newOrderOffer.itemCount || 0,
          createdAt: newOrderOffer.createdAt || new Date().toISOString(),
          pickupDistance: newOrderOffer.restaurantDistance,
          estimatedDistance: newOrderOffer.deliveryDistance,
        };
        console.log('[Orders] wsOrder created successfully');
        triggerNotification(wsOrder);
      } catch (error) {
        console.error('[Orders] Error processing newOrderOffer:', error);
      }
    }
  }, [newOrderOffer, isOnline, showNewOrderBanner, triggerNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
      }
    };
  }, []);

  const hideBanner = useCallback(() => {
    // Stop animations and clear timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (pulseAnimationRef.current) {
      pulseAnimationRef.current.stop();
      pulseAnimationRef.current = null;
    }

    Animated.timing(bannerAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNewOrderBanner(false);
      setBannerOrder(null);
      clearNewOrderOffer();
    });
  }, [bannerAnim, clearNewOrderOffer]);

  const handleNewOrderPress = () => {
    if (bannerOrder) {
      const orderId = bannerOrder.orderId;
      hideBanner();
      router.push(`/available-order/${orderId}`);
    }
  };

  // Refresh available orders when tab changes to available
  useEffect(() => {
    if (activeTab === 'available' && isOnline) {
      fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
    }
  }, [activeTab, isOnline]);

  // Fetch order history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history' && orderHistory.length === 0) {
      fetchOrderHistory(0, 10);
    }
  }, [activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
    setIsRefreshing(false);
  };

  const handleHistoryRefresh = useCallback(async () => {
    setIsHistoryRefreshing(true);
    await fetchOrderHistory(0, 10);
    setIsHistoryRefreshing(false);
  }, [fetchOrderHistory]);

  const handleLoadMoreHistory = useCallback(() => {
    if (!isLoadingHistory && historyPagination.hasMore) {
      loadMoreHistory();
    }
  }, [isLoadingHistory, historyPagination.hasMore, loadMoreHistory]);

  const renderHistoryFooter = useCallback(() => {
    if (!historyPagination.hasMore) return null;
    if (isLoadingHistory) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    return null;
  }, [isLoadingHistory, historyPagination.hasMore]);

  const TabButton = ({ title, tab, count }: { title: string, tab: 'available' | 'active' | 'history', count?: number }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabText,
        activeTab === tab && styles.tabTextActive
      ]}>
        {title}
        {count !== undefined && count > 0 && ` (${count})`}
      </Text>
    </TouchableOpacity>
  );

  const renderAvailableOrder = ({ item }: { item: AvailableOrder }) => (
    <AvailableOrderCard order={item} />
  );

  const renderActiveOrder = ({ item }: { item: Order }) => (
    <OrderCard order={item} />
  );

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="orders">
      <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* New Order Notification Banner */}
      {showNewOrderBanner && bannerOrder && (
        <Animated.View
          style={[
            styles.newOrderBanner,
            {
              transform: [
                { translateY: bannerAnim },
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.newOrderBannerContent}
            onPress={handleNewOrderPress}
            activeOpacity={0.9}
          >
            <View style={styles.newOrderIconContainer}>
              <Package size={24} color={Colors.surface} />
            </View>
            <View style={styles.newOrderTextContainer}>
              <Text style={styles.newOrderTitle}>{t('orders.new_order_available')}</Text>
              <Text style={styles.newOrderSubtitle} numberOfLines={1}>
                {bannerOrder.restaurantName || t('orders.tap_to_view')}
              </Text>
            </View>
            <View style={styles.newOrderAction}>
              <Text style={styles.newOrderActionText}>{t('orders.view')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={hideBanner}>
            <Text style={styles.dismissText}>×</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('orders.good_morning', { name: user?.firstName || '' })}</Text>
          <Text style={styles.statusText}>
            {t('orders.you_are_online')} <Text style={{ color: isOnline ? Colors.online : Colors.offline, fontWeight: '700' }}>
              {isOnline ? t('orders.online') : t('orders.offline')}
            </Text>
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
          >
            <Bell size={24} color={Colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                {unreadCount > 9 ? (
                  <Text style={styles.badgeText}>9+</Text>
                ) : unreadCount > 0 ? (
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                ) : null}
              </View>
            )}
          </TouchableOpacity>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: Colors.border, true: Colors.online }}
            thumbColor={Colors.surface}
          />
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <View style={styles.tabsWrapper}>
          <TabButton title={t('orders.available', 'Available')} tab="available" count={availableOrders.length} />
          <TabButton title={t('orders.active', 'Active')} tab="active" count={activeOrders.length} />
          <TabButton title={t('orders.history', 'History')} tab="history" />
        </View>
      </View>

      {activeTab === 'available' && (
        <FlatList
          data={isOnline ? availableOrders : []}
          keyExtractor={(item) => item.orderId.toString()}
          renderItem={renderAvailableOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isLoadingAvailableOrders ? (
                <ActivityIndicator size="large" color={Colors.primary} />
              ) : !isOnline ? (
                <>
                  <Text style={styles.emptyStateText}>
                    {t('orders.go_online_to_see_orders', 'Go online to see available orders')}
                  </Text>
                </>
              ) : (
                <Text style={styles.emptyStateText}>
                  {t('orders.no_available_orders', 'No orders available nearby. Pull down to refresh.')}
                </Text>
              )}
            </View>
          }
        />
      )}

      {activeTab === 'active' && (
        <FlatList
          data={activeOrders}
          keyExtractor={(item) => item.orderId.toString()}
          renderItem={renderActiveOrder}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {t('orders.no_active_orders', 'No active orders')}
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'history' && (
        <FlatList
          data={orderHistory}
          keyExtractor={(item) => item.orderId.toString()}
          renderItem={renderActiveOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isHistoryRefreshing}
              onRefresh={handleHistoryRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMoreHistory}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderHistoryFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isLoadingHistory && orderHistory.length === 0 ? (
                <ActivityIndicator size="large" color={Colors.primary} />
              ) : (
                <Text style={styles.emptyStateText}>
                  {t('orders.no_history', 'No delivery history')}
                </Text>
              )}
            </View>
          }
        />
      )}
      </View>
    </WithSwipeGesture>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.secondary,
  },
  statusText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tabsContainer: {
    padding: 16,
    backgroundColor: Colors.background,
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.secondary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.surface,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: Colors.textLight,
    textAlign: 'center',
    fontSize: 16,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  newOrderBanner: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: Colors.success,
    borderRadius: 16,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  newOrderBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingRight: 40,
  },
  newOrderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  newOrderTextContainer: {
    flex: 1,
  },
  newOrderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
    marginBottom: 2,
  },
  newOrderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  newOrderAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newOrderActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '300',
  },
});

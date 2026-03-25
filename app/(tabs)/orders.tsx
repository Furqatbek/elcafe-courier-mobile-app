import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Switch, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useCourier, AvailableOrder, Order } from '@/context/CourierContext';
import { OrderCard } from '@/components/OrderCard';
import { AvailableOrderCard } from '@/components/AvailableOrderCard';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';
import { useToast } from '@/components/Toast';
import { OrderOfferModal } from '@/components/OrderOfferModal';
import { soundService } from '@/services/soundService';

// Get greeting key based on current hour
const getGreetingKey = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'orders.good_morning';
  if (hour >= 12 && hour < 17) return 'orders.good_afternoon';
  if (hour >= 17 && hour < 21) return 'orders.good_evening';
  return 'orders.good_night'; // 21:00 - 4:59
};

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
    acceptOrder,
  } = useCourier();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);

  // Order offer modal state
  const [showOrderOfferModal, setShowOrderOfferModal] = useState(false);
  const [offerOrder, setOfferOrder] = useState<AvailableOrder | null>(null);
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedRef = useRef(false);

  // Initialize sound service
  useEffect(() => {
    soundService.initialize();
    return () => {
      soundService.cleanup();
    };
  }, []);

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
      showingModal: showOrderOfferModal
    });

    // Show order offer modal for the first new order
    if (newOrders.length > 0 && !showOrderOfferModal) {
      const newestOrder = newOrders[0];
      console.log('[Orders] New order detected! Showing offer modal for:', newestOrder.orderId);
      showOrderOffer(newestOrder);
    }

    // Update previous order IDs
    previousOrderIdsRef.current = currentOrderIds;
  }, [availableOrders, isOnline, showOrderOfferModal]);

  // Show order offer modal
  const showOrderOffer = useCallback((order: AvailableOrder) => {
    console.log('[Orders] Showing order offer modal for:', order.orderId);
    setOfferOrder(order);
    setShowOrderOfferModal(true);
  }, []);

  // Show notification when new order arrives via WebSocket
  useEffect(() => {
    if (newOrderOffer && isOnline && !showOrderOfferModal) {
      try {
        console.log('[Orders] WebSocket new order notification:', newOrderOffer.orderId);
        // Convert WebSocket notification to AvailableOrder format for display
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
        showOrderOffer(wsOrder);
      } catch (error) {
        console.error('[Orders] Error processing newOrderOffer:', error);
      }
    }
  }, [newOrderOffer, isOnline, showOrderOfferModal, showOrderOffer]);

  // Handle accepting order from modal
  const handleAcceptOrder = useCallback(async (orderId: number) => {
    try {
      await acceptOrder(orderId);
      setShowOrderOfferModal(false);
      setOfferOrder(null);
      clearNewOrderOffer();
      // Navigate to the map navigation screen
      router.push(`/map-navigation/${orderId}`);
    } catch (error: any) {
      // Check if order was already taken
      const errorMessage = error.message || '';
      if (
        errorMessage.includes('already has a courier assigned') ||
        errorMessage.includes('already assigned') ||
        errorMessage.includes('ORDER_TAKEN')
      ) {
        Alert.alert(
          t('available_orders.order_taken_title', 'Order No Longer Available'),
          t('available_orders.order_already_taken', 'This order was already taken by another courier.')
        );
        setShowOrderOfferModal(false);
        setOfferOrder(null);
        clearNewOrderOffer();
        fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
      } else {
        Alert.alert(t('common.error'), errorMessage || t('available_orders.accept_error'));
        throw error; // Re-throw so modal knows acceptance failed
      }
    }
  }, [acceptOrder, clearNewOrderOffer, fetchAvailableOrders, currentLocation, router, t]);

  // Handle declining order from modal
  const handleDeclineOrder = useCallback(() => {
    setShowOrderOfferModal(false);
    setOfferOrder(null);
    clearNewOrderOffer();
  }, [clearNewOrderOffer]);

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
      {/* Full-screen Order Offer Modal */}
      <OrderOfferModal
        visible={showOrderOfferModal}
        order={offerOrder}
        onAccept={handleAcceptOrder}
        onDecline={handleDeclineOrder}
        timeoutSeconds={60}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t(getGreetingKey(), { name: user?.firstName || '' })}</Text>
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
});

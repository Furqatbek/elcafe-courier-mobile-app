import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Switch, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useCourier, AvailableOrder, Order } from '@/context/CourierContext';
import { OrderCard } from '@/components/OrderCard';
import { AvailableOrderCard } from '@/components/AvailableOrderCard';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';
import { OrderOfferModal } from '@/components/OrderOfferModal';
import { LocationDisclosureModal, LOCATION_DISCLOSURE_ACCEPTED_KEY } from '@/components/LocationDisclosureModal';
import { soundService } from '@/services/soundService';
import logger from '@/lib/logger';

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
  // The tab bar is now as tall as its row PLUS the system navigation bar
  // inset, so a hardcoded bottom padding no longer clears it and the last
  // row of the list ends up unreachable underneath it. useBottomTabBarHeight
  // reports the real measured height, so this tracks the tab bar itself.
  const tabBarHeight = useBottomTabBarHeight();
  const {
    activeOrders,
    availableOrders,
    isLoadingAvailableOrders,
    fetchAvailableOrders,
    refreshData,
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
    orderTakenEvent,
    clearOrderTakenEvent,
    courierProfile,
  } = useCourier();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);

  // Order offer modal state
  const [showOrderOfferModal, setShowOrderOfferModal] = useState(false);
  const [offerOrder, setOfferOrder] = useState<AvailableOrder | null>(null);
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedRef = useRef(false);

  // Location prominent disclosure (Google Play policy): location permission
  // may only be requested after the user accepts this disclosure once.
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const disclosureAcceptedRef = useRef<boolean | null>(null); // null = not read yet

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
      logger.log('[Orders] Initial load, storing order IDs:', Array.from(currentOrderIds));
      previousOrderIdsRef.current = currentOrderIds;
      hasInitializedRef.current = true;
      return;
    }

    // Find new orders (in current but not in previous)
    const newOrders = availableOrders.filter(
      order => !previousOrderIdsRef.current.has(order.orderId)
    );

    logger.log('[Orders] Checking for new orders:', {
      previous: Array.from(previousOrderIdsRef.current),
      current: Array.from(currentOrderIds),
      newOrders: newOrders.map(o => o.orderId),
      showingModal: showOrderOfferModal
    });

    // Show order offer modal for the first new order
    if (newOrders.length > 0 && !showOrderOfferModal) {
      const newestOrder = newOrders[0];
      logger.log('[Orders] New order detected! Showing offer modal for:', newestOrder.orderId);
      showOrderOffer(newestOrder);
    }

    // Update previous order IDs
    previousOrderIdsRef.current = currentOrderIds;
  }, [availableOrders, isOnline, showOrderOfferModal]);

  // Show order offer modal
  const showOrderOffer = useCallback((order: AvailableOrder) => {
    logger.log('[Orders] Showing order offer modal for:', order.orderId);
    setOfferOrder(order);
    setShowOrderOfferModal(true);
  }, []);

  // Show notification when new order arrives via WebSocket
  useEffect(() => {
    if (newOrderOffer && isOnline && !showOrderOfferModal) {
      try {
        logger.log('[Orders] WebSocket new order notification:', newOrderOffer.orderId);
        // Convert WebSocket notification to AvailableOrder format for display
        const wsOrder: AvailableOrder = {
          orderId: newOrderOffer.orderId,
          externalOrderNo: newOrderOffer.externalOrderNo ?? String(newOrderOffer.orderId),
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
          status: 'PENDING',
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
        logger.error('[Orders] Error processing newOrderOffer:', error);
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

  // Close the offer modal if the displayed order gets taken by another
  // courier while it is still on screen. Our own accept also broadcasts
  // ORDER_TAKEN — ignore events carrying our courierId (handleAcceptOrder
  // already closes the modal on success).
  useEffect(() => {
    if (!orderTakenEvent || !offerOrder || orderTakenEvent.orderId !== offerOrder.orderId) {
      return;
    }
    const myCourierId = courierProfile?.id;
    if (myCourierId != null && Number(orderTakenEvent.courierId) === Number(myCourierId)) {
      return;
    }
    logger.log('[Orders] Offered order taken by another courier, closing modal:', orderTakenEvent.orderId);
    setShowOrderOfferModal(false);
    setOfferOrder(null);
    clearNewOrderOffer();
    clearOrderTakenEvent();
  }, [orderTakenEvent, offerOrder, courierProfile, clearNewOrderOffer, clearOrderTakenEvent]);

  // Read the persisted disclosure acceptance lazily (first toggle wins)
  const isDisclosureAccepted = useCallback(async (): Promise<boolean> => {
    if (disclosureAcceptedRef.current !== null) {
      return disclosureAcceptedRef.current;
    }
    try {
      const value = await AsyncStorage.getItem(LOCATION_DISCLOSURE_ACCEPTED_KEY);
      disclosureAcceptedRef.current = value === 'true';
    } catch (error) {
      logger.warn('[Orders] Failed to read location disclosure flag:', error);
      disclosureAcceptedRef.current = false;
    }
    return disclosureAcceptedRef.current;
  }, []);

  // Run the actual online/offline toggle and surface failures to the user.
  // The Switch is controlled by isOnline, which only flips after the server
  // accepts the status change — so on failure it simply stays where it was.
  const performToggleOnline = useCallback(async () => {
    try {
      await toggleOnline();
    } catch (error: any) {
      const message: string = error?.message || '';
      if (message.includes('Location permission denied')) {
        Alert.alert(
          t('orders.location_permission_title', 'Location Permission Needed'),
          t('orders.location_permission_message', 'Going online requires location access so we can send you nearby orders and share your position during deliveries. Please enable location for this app in your device settings.'),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            {
              text: t('orders.open_settings', 'Open Settings'),
              onPress: () => {
                Linking.openSettings().catch((settingsError) => {
                  logger.warn('[Orders] Failed to open settings:', settingsError);
                });
              },
            },
          ]
        );
      } else {
        logger.error('[Orders] Failed to toggle online status:', error);
        // Show the server's reason, not just the generic line. "Could not
        // update your status" is the same text whether the courier is not yet
        // approved, the endpoint moved, or the network is down - and it left
        // nothing to act on or report.
        Alert.alert(
          t('common.error', 'Error'),
          message
            ? `${t('orders.toggle_online_failed', 'Could not update your status. Please check your connection and try again.')}\n\n${message}`
            : t('orders.toggle_online_failed', 'Could not update your status. Please check your connection and try again.')
        );
      }
    }
  }, [toggleOnline, t]);

  // Switch handler: going online the first time shows the location
  // disclosure; the OS permission prompt only ever follows "Agree".
  const handleToggleOnline = useCallback(async () => {
    if (isOnline) {
      // Going offline never needs the disclosure
      await performToggleOnline();
      return;
    }
    if (await isDisclosureAccepted()) {
      await performToggleOnline();
    } else {
      setShowLocationDisclosure(true);
    }
  }, [isOnline, isDisclosureAccepted, performToggleOnline]);

  const handleDisclosureAgree = useCallback(async () => {
    setShowLocationDisclosure(false);
    disclosureAcceptedRef.current = true;
    try {
      await AsyncStorage.setItem(LOCATION_DISCLOSURE_ACCEPTED_KEY, 'true');
    } catch (error) {
      logger.warn('[Orders] Failed to persist location disclosure acceptance:', error);
    }
    await performToggleOnline();
  }, [performToggleOnline]);

  const handleDisclosureNotNow = useCallback(() => {
    // Toggle stays off: isOnline was never changed
    setShowLocationDisclosure(false);
  }, []);

  // Fetch order history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history' && orderHistory.length === 0) {
      fetchOrderHistory(0, 10);
    }
  }, [activeTab]);

  // Fetch available and active orders on mount (handles page refresh)
  useEffect(() => {
    if (isOnline) {
      fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
      refreshData();
    }
  }, [isOnline]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude),
      refreshData(),
    ]);
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

  const renderAvailableOrder = useCallback(({ item }: { item: AvailableOrder }) => (
    <AvailableOrderCard order={item} />
  ), []);

  const renderActiveOrder = useCallback(({ item }: { item: Order }) => (
    <OrderCard order={item} />
  ), []);

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="orders">
      <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Full-screen Order Offer Modal */}
      <OrderOfferModal
        visible={showOrderOfferModal}
        order={offerOrder}
        onAccept={handleAcceptOrder}
        onDecline={handleDeclineOrder}
      />

      {/* Prominent location disclosure — must be accepted before the OS
          location permission prompt is ever shown */}
      <LocationDisclosureModal
        visible={showLocationDisclosure}
        onAgree={handleDisclosureAgree}
        onNotNow={handleDisclosureNotNow}
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
            onValueChange={handleToggleOnline}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 16 }]}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 16 }]}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 16 }]}
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

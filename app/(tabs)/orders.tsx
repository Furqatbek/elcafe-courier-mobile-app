import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Switch, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useCourier, AvailableOrder, Order } from '@/context/CourierContext';
import { OrderCard } from '@/components/OrderCard';
import { AvailableOrderCard } from '@/components/AvailableOrderCard';
import { WithSwipeGesture } from '@/components/WithSwipeGesture';

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
  } = useCourier();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);

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
          data={availableOrders}
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

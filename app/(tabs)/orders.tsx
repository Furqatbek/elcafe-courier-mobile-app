import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useCourier } from '@/context/CourierContext';
import { OrderCard } from '@/components/OrderCard';
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
  const { activeOrders, completedOrders, isOnline, toggleOnline } = useCourier();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const orders = activeTab === 'active' ? activeOrders : completedOrders;

  const TabButton = ({ title, tab }: { title: string, tab: 'active' | 'history' }) => (
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
      </Text>
    </TouchableOpacity>
  );

  return (
    <WithSwipeGesture routes={TAB_ROUTES} currentRouteName="orders">
      <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('orders.good_morning', { name: 'John' })}</Text>
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
            <View style={styles.badge} />
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
          <TabButton title={t('orders.active_orders', { count: activeOrders.length })} tab="active" />
          <TabButton title={t('orders.history')} tab="history" />
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {activeTab === 'active' 
                ? t('orders.no_active_orders')
                : t('orders.no_history')}
            </Text>
          </View>
        }
      />
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
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: Colors.surface,
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
});

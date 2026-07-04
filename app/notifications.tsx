import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Package,
  DollarSign,
  Star,
  CheckCircle,
  CheckCheck,
  XCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCourier, Notification } from '@/context/CourierContext';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/formatting';

import { Truck } from 'lucide-react-native';

const notificationIcons: Record<string, any> = {
  NEW_ORDER_NEARBY: Package,
  ORDER_ASSIGNED: Package,
  ORDER_CANCELLED: XCircle,
  PAYOUT_ISSUED: DollarSign,
  VERIFICATION_APPROVED: CheckCircle,
  RATING_RECEIVED: Star,
  NEW_DELIVERY_AVAILABLE: Truck,
  DELIVERY_COMPLETED: CheckCircle,
  DELIVERY_CANCELLED: XCircle,
};

const notificationColors: Record<string, string> = {
  NEW_ORDER_NEARBY: Colors.primary,
  ORDER_ASSIGNED: Colors.success,
  ORDER_CANCELLED: Colors.danger,
  PAYOUT_ISSUED: Colors.success,
  VERIFICATION_APPROVED: Colors.success,
  RATING_RECEIVED: Colors.warning,
  NEW_DELIVERY_AVAILABLE: Colors.primary,
  DELIVERY_COMPLETED: Colors.success,
  DELIVERY_CANCELLED: Colors.danger,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoadingNotifications,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useCourier();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handleMarkAllRead = useCallback(async () => {
    setIsMarkingAllRead(true);
    await markAllNotificationsAsRead();
    setIsMarkingAllRead(false);
  }, [markAllNotificationsAsRead]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications();
    setIsRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    // Use orderId from notification directly, or fall back to data.orderId
    const orderId = notification.orderId || notification.data?.orderId;
    if (orderId) {
      router.push(`/order/${orderId}`);
    }
  }, [markNotificationAsRead, router]);

  const renderNotificationItem = useCallback(({ item }: { item: Notification }) => {
    const Icon = notificationIcons[item.type] || AlertCircle;
    const iconColor = notificationColors[item.type] || Colors.textSecondary;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <Icon size={22} color={iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
        <ChevronRight size={18} color={Colors.textLight} />
      </TouchableOpacity>
    );
  }, [handleNotificationPress]);

  return (
    <>
      <Stack.Screen options={{ title: t('notifications.title') }} />
      <View style={styles.container}>
        {notifications.length > 0 && unreadCount > 0 && (
          <TouchableOpacity
            style={styles.readAllButton}
            onPress={handleMarkAllRead}
            disabled={isMarkingAllRead}
            activeOpacity={0.7}
          >
            <CheckCheck size={18} color={Colors.primary} />
            <Text style={styles.readAllText}>
              {t('notifications.read_all')}
            </Text>
          </TouchableOpacity>
        )}
        {isLoadingNotifications && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('notifications.empty_title')}
            message={t('notifications.empty_message')}
          />
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
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
  readAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  readAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  notificationUnread: {
    backgroundColor: Colors.primary + '08',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 4,
  },
});

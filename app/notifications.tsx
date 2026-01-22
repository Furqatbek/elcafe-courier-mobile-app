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
  XCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { NOTIFICATION_TYPES } from '@/constants/config';
import { useToast } from '@/components/Toast';
import { api, Notification } from '@/services/api';
import { EmptyState } from '@/components/EmptyState';
import { formatRelativeTime } from '@/lib/formatting';

const notificationIcons: Record<string, any> = {
  NEW_ORDER_NEARBY: Package,
  ORDER_ASSIGNED: Package,
  ORDER_CANCELLED: XCircle,
  PAYOUT_ISSUED: DollarSign,
  VERIFICATION_APPROVED: CheckCircle,
  RATING_RECEIVED: Star,
};

const notificationColors: Record<string, string> = {
  NEW_ORDER_NEARBY: Colors.primary,
  ORDER_ASSIGNED: Colors.success,
  ORDER_CANCELLED: Colors.danger,
  PAYOUT_ISSUED: Colors.success,
  VERIFICATION_APPROVED: Colors.success,
  RATING_RECEIVED: Colors.warning,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await api.notifications.getAll();
      setNotifications(data);
    } catch (error: any) {
      if (!showRefreshing) {
        toast.error(error.message || t('notifications.fetch_error'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await api.notifications.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    if (notification.data?.orderId) {
      router.push(`/order/${notification.data.orderId}`);
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
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
  };

  return (
    <>
      <Stack.Screen options={{ title: t('notifications.title') }} />
      <View style={styles.container}>
        {isLoading ? (
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
                onRefresh={() => fetchNotifications(true)}
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

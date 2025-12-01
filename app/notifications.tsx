import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, Check, Package, DollarSign, Star } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Notification {
  id: string;
  type: 'order' | 'earnings' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'order',
    title: 'New Order Available',
    message: 'Pickup from Burger King - 2.5 km away',
    time: '2 min ago',
    read: false,
  },
  {
    id: '2',
    type: 'earnings',
    title: 'Daily Earnings Report',
    message: 'You earned $45.50 today so far!',
    time: '4 hours ago',
    read: false,
  },
  {
    id: '3',
    type: 'system',
    title: 'High Demand Area',
    message: 'It\'s busy in Downtown. Head there for more orders.',
    time: '5 hours ago',
    read: true,
  },
  {
    id: '4',
    type: 'system',
    title: 'Weekly Bonus Unlocked',
    message: 'Congratulations! You completed 20 orders this week.',
    time: '1 day ago',
    read: true,
  }
];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationPress = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order': return <Package size={24} color={Colors.primary} />;
      case 'earnings': return <DollarSign size={24} color="#10B981" />;
      case 'system': return <Bell size={24} color="#F59E0B" />;
      default: return <Bell size={24} color={Colors.text} />;
    }
  };

  const getIconBackground = (type: Notification['type']) => {
    switch (type) {
      case 'order': return 'rgba(37, 99, 235, 0.1)';
      case 'earnings': return 'rgba(16, 185, 129, 0.1)';
      case 'system': return 'rgba(245, 158, 11, 0.1)';
      default: return Colors.background;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications_page.title')}</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markReadText}>{t('notifications_page.mark_all_read')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.notificationItem, !item.read && styles.unreadItem]}
            onPress={() => handleNotificationPress(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: getIconBackground(item.type) }]}>
              {getIcon(item.type)}
            </View>
            <View style={styles.contentContainer}>
              <View style={styles.topRow}>
                <Text style={[styles.title, !item.read && styles.unreadText]}>{item.title}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>{t('notifications_page.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unreadItem: {
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: '#F8FAFC',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    color: Colors.text,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: Colors.textLight,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textLight,
  },
});

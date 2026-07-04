import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import {
  Package,
  Bell,
  MessageSquare,
  Search,
  Inbox,
  Clock,
  MapPin,
  LucideIcon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Button } from './Button';

type EmptyStateType =
  | 'orders'
  | 'history'
  | 'notifications'
  | 'messages'
  | 'search'
  | 'general'
  | 'location'
  | 'custom';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

const getDefaultIcon = (type: EmptyStateType): LucideIcon => {
  switch (type) {
    case 'orders':
      return Package;
    case 'history':
      return Clock;
    case 'notifications':
      return Bell;
    case 'messages':
      return MessageSquare;
    case 'search':
      return Search;
    case 'location':
      return MapPin;
    case 'general':
    default:
      return Inbox;
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'general',
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}) => {
  const Icon = icon || getDefaultIcon(type);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon size={48} color={Colors.textLight} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actionsContainer}>
          {actionLabel && onAction && (
            <Button
              title={actionLabel}
              onPress={onAction}
              variant="primary"
              style={styles.actionButton}
            />
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="outline"
              style={styles.secondaryButton}
            />
          )}
        </View>
      )}
    </View>
  );
};

// Pre-configured empty states for common use cases
export const NoOrdersEmpty: React.FC<{ onGoOnline?: () => void }> = ({ onGoOnline }) => (
  <EmptyState
    type="orders"
    title="No Active Orders"
    message="Stay online to receive new delivery requests!"
    actionLabel={onGoOnline ? "Go Online" : undefined}
    onAction={onGoOnline}
  />
);

export const NoHistoryEmpty: React.FC = () => (
  <EmptyState
    type="history"
    title="No Delivery History"
    message="Completed deliveries will appear here."
  />
);

export const NoNotificationsEmpty: React.FC = () => (
  <EmptyState
    type="notifications"
    title="No Notifications"
    message="You're all caught up! New notifications will appear here."
  />
);

export const NoMessagesEmpty: React.FC = () => (
  <EmptyState
    type="messages"
    title="No Messages"
    message="Start a conversation with customers or support."
  />
);

export const NoSearchResultsEmpty: React.FC<{ query?: string; onClear?: () => void }> = ({
  query,
  onClear,
}) => (
  <EmptyState
    type="search"
    title="No Results Found"
    message={query ? `We couldn't find anything for "${query}"` : "Try adjusting your search."}
    actionLabel={onClear ? "Clear Search" : undefined}
    onAction={onClear}
  />
);

export const LocationPermissionEmpty: React.FC<{ onRequestPermission?: () => void }> = ({
  onRequestPermission,
}) => (
  <EmptyState
    type="location"
    title="Location Access Required"
    message="Enable location access to see nearby orders and navigate to delivery locations."
    actionLabel="Enable Location"
    onAction={onRequestPermission}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  actionsContainer: {
    marginTop: 24,
    width: '100%',
    maxWidth: 240,
  },
  actionButton: {
    marginBottom: 12,
  },
  secondaryButton: {},
});

export default EmptyState;

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Dimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Package,
  Clock,
  Store,
  Navigation,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AvailableOrder } from '@/context/CourierContext';
import { courierEarnings, hasTip, formatCurrency } from '@/lib/formatting';
import { soundService } from '@/services/soundService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default timeout in seconds (can be customized via props)
const DEFAULT_TIMEOUT = 60;

interface OrderOfferModalProps {
  visible: boolean;
  order: AvailableOrder | null;
  onAccept: (orderId: number) => Promise<void>;
  onDecline: () => void;
  timeoutSeconds?: number;
}

export const OrderOfferModal = React.memo(function OrderOfferModal({
  visible,
  order,
  onAccept,
  onDecline,
  timeoutSeconds = DEFAULT_TIMEOUT,
}: OrderOfferModalProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
  const [isAccepting, setIsAccepting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format distance
  const formatDistance = (km: number | undefined) => {
    const value = km ?? 0;
    if (value < 1) {
      return `${(value * 1000).toFixed(0)} m`;
    }
    return `${value.toFixed(1)} km`;
  };

  // Start animations and sounds when modal becomes visible
  useEffect(() => {
    if (visible && order) {
      // Reset state
      setTimeLeft(timeoutSeconds);
      setIsAccepting(false);

      // Play sound
      soundService.playNewOrderSound();

      // Start vibration pattern (vibrate every 2 seconds)
      Vibration.vibrate([0, 500, 500, 500], false);
      vibrationRef.current = setInterval(() => {
        Vibration.vibrate([0, 300, 200, 300], false);
      }, 3000);

      // Slide in animation
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();

      // Pulse animation for the accept button
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Progress bar animation
      progressAnim.setValue(1);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: timeoutSeconds * 1000,
        useNativeDriver: false,
      }).start();

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleDecline();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        pulseAnimation.stop();
      };
    }
  }, [visible, order, timeoutSeconds]);

  // Cleanup on unmount or when modal closes
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (vibrationRef.current) {
      clearInterval(vibrationRef.current);
      vibrationRef.current = null;
    }
    Vibration.cancel();
    soundService.stopNewOrderSound();
  }, []);

  const handleAccept = async () => {
    if (!order || isAccepting) return;

    setIsAccepting(true);
    cleanup();

    try {
      await onAccept(order.orderId);
    } catch {
      setIsAccepting(false);
      // Error handling is done in parent component
    }
  };

  const handleDecline = useCallback(() => {
    cleanup();

    // Slide out animation
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDecline();
    });
  }, [cleanup, onDecline, slideAnim]);

  if (!order) return null;

  const earnings = courierEarnings(order);
  const restaurantName = order.restaurantName ?? 'Restaurant';
  const deliveryAddress = order.deliveryAddress ?? 'Delivery location';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Progress bar at top */}
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Header with timer */}
          <View style={styles.header}>
            <View style={styles.timerContainer}>
              <Clock size={20} color={Colors.warning} />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
            <Text style={styles.headerTitle}>{t('order_offer.new_order', 'New Order!')}</Text>
            <TouchableOpacity onPress={handleDecline} style={styles.closeButton}>
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Earnings highlight */}
          <View style={styles.earningsSection}>
            <Text style={styles.earningsLabel}>{t('order_offer.estimated_earnings', 'Estimated Earnings')}</Text>
            <Text style={styles.earningsAmount}>{formatCurrency(earnings)}</Text>
            {hasTip(order) && (
              <View style={styles.tipBadge}>
                <Text style={styles.tipText}>
                  +{formatCurrency(order.tipAmount)} {t('order_offer.tip', 'tip')}
                </Text>
              </View>
            )}
          </View>

          {/* Order details */}
          <View style={styles.detailsSection}>
            {/* Pickup */}
            <View style={styles.locationRow}>
              <View style={[styles.locationIcon, styles.pickupIcon]}>
                <Store size={18} color={Colors.surface} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>{t('order_offer.pickup', 'PICKUP')}</Text>
                <Text style={styles.locationName} numberOfLines={1}>{restaurantName}</Text>
                {order.pickupDistance !== undefined && (
                  <Text style={styles.distanceText}>
                    {formatDistance(order.pickupDistance)} {t('order_offer.away', 'away')}
                  </Text>
                )}
              </View>
            </View>

            {/* Route line */}
            <View style={styles.routeLine}>
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
              <View style={styles.routeDot} />
            </View>

            {/* Dropoff */}
            <View style={styles.locationRow}>
              <View style={[styles.locationIcon, styles.dropoffIcon]}>
                <MapPin size={18} color={Colors.surface} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>{t('order_offer.dropoff', 'DROP-OFF')}</Text>
                <Text style={styles.locationName} numberOfLines={1}>{deliveryAddress}</Text>
                {order.estimatedDistance !== undefined && (
                  <Text style={styles.distanceText}>
                    {formatDistance(order.estimatedDistance)} {t('order_offer.total', 'total')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Items count */}
          <View style={styles.itemsRow}>
            <Package size={18} color={Colors.textSecondary} />
            <Text style={styles.itemsText}>
              {order.itemCount ?? 0} {t('order_offer.items', 'items')}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              disabled={isAccepting}
            >
              <Text style={styles.declineButtonText}>{t('order_offer.decline', 'Decline')}</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: pulseAnim }], flex: 2 }}>
              <TouchableOpacity
                style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
                onPress={handleAccept}
                disabled={isAccepting}
                activeOpacity={0.8}
              >
                {isAccepting ? (
                  <Text style={styles.acceptButtonText}>{t('order_offer.accepting', 'Accepting...')}</Text>
                ) : (
                  <>
                    <Navigation size={20} color={Colors.surface} />
                    <Text style={styles.acceptButtonText}>{t('order_offer.accept', 'Accept Order')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.warning,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 8,
  },
  earningsSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: Colors.success + '10',
    marginHorizontal: 16,
    borderRadius: 16,
  },
  earningsLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.success,
  },
  tipBadge: {
    marginTop: 8,
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  detailsSection: {
    padding: 20,
    paddingTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pickupIcon: {
    backgroundColor: Colors.primary,
  },
  dropoffIcon: {
    backgroundColor: Colors.accent,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  distanceText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  routeLine: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 12,
    paddingLeft: 48,
  },
  routeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.border,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 16,
  },
  itemsText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.success + '80',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
});

export default OrderOfferModal;

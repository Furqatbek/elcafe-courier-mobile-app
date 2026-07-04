import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform, Linking, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Phone, Navigation, ArrowLeft, CreditCard, Package, AlertTriangle, X, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DEFAULTS, ISSUE_TYPES } from '@/constants/config';
import { useCourier, OrderStatus, Order, IssueType } from '@/context/CourierContext';
import { SlideButton } from '@/components/SlideButton';
import { StatusBadge } from '@/components/StatusBadge';
import OrderMap from '@/components/OrderMap';


export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, orderHistory, updateOrderStatus, completeOrder, reportOrderIssue, fetchOrderDetails } = useCourier();
  const orderId = Number(id);
  const [order, setOrder] = useState<Order | null | undefined>(
    orders.find(o => o.orderId === orderId) || orderHistory.find(o => o.orderId === orderId)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  useEffect(() => {
    // First check local state
    const localOrder = orders.find(o => o.orderId === orderId) || orderHistory.find(o => o.orderId === orderId);
    if (localOrder) {
      setOrder(localOrder);
    } else {
      // Fetch from API if not found locally
      const loadOrder = async () => {
        setIsLoading(true);
        const fetchedOrder = await fetchOrderDetails(orderId);
        setOrder(fetchedOrder);
        setIsLoading(false);
      };
      loadOrder();
    }
  }, [orders, orderHistory, orderId, fetchOrderDetails]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.notFoundText}>{t('order_detail.not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatCurrency = (amount: number | undefined) => {
    return `${(amount ?? 0).toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  // Support both flat (new backend) and nested (old interface) field names
  const restaurantName = order.restaurantName ?? order.restaurant?.name ?? '-';
  const restaurantAddress = order.restaurantAddress ?? order.restaurant?.address ?? '-';
  const restaurantPhone = order.customerPhone ?? order.restaurant?.phone ?? null; // backend uses customerPhone for contact
  const customerName = order.customerName ?? order.customer?.name ?? '-';
  const customerPhone = order.customerPhone ?? order.customer?.phone ?? null;
  const deliveryAddr = order.deliveryAddress ?? order.deliveryAddress?.fullAddress ?? '-';
  const deliveryInstructions = order.deliveryInstructions ?? order.deliveryAddress?.instructions ?? null;
  const orderNumber = order.externalOrderNo ?? order.orderNumber ?? '-';
  const itemCount = order.itemCount ?? order.items?.length ?? 0;
  const totalAmount = order.total ?? order.totalAmount ?? ((order.deliveryFee ?? 0) + (order.tipAmount ?? 0));

  const handleSlideComplete = async () => {
    console.log('[OrderDetail] handleSlideComplete called, order.status:', order.status, 'orderId:', order.orderId);
    try {
      if (order.status === 'COURIER_ASSIGNED' || order.status === 'READY') {
        console.log('[OrderDetail] Updating status to PICKED_UP...');
        await updateOrderStatus(order.orderId, 'PICKED_UP');
        router.push(`/map-navigation/${order.orderId}`);
      } else if (order.status === 'PICKED_UP' || order.status === 'IN_TRANSIT') {
        console.log('[OrderDetail] Completing order...');
        const result = await completeOrder(order.orderId);
        console.log('[OrderDetail] completeOrder result:', result);
        if (result) {
          Alert.alert(
            t('order_detail.delivery_complete'),
            t('order_detail.earned_amount', { amount: formatCurrency(result.earnings) }),
            [{ text: t('common.ok'), onPress: () => router.replace(`/order-rating/${order.orderId}`) }]
          );
        }
      } else {
        console.warn('[OrderDetail] Unhandled order status for slide action:', order.status);
      }
    } catch (error: any) {
      console.error('[OrderDetail] Error in handleSlideComplete:', error);
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('not ready for pickup')) {
        Alert.alert(
          t('order_detail.not_ready_title'),
          t('order_detail.not_ready_message')
        );
      } else {
        Alert.alert(t('common.error'), msg || t('order_detail.status_update_failed'));
      }
      throw error;
    }
  };

  const handleReportIssue = async () => {
    if (!selectedIssueType || !issueDescription.trim()) {
      Alert.alert(t('common.error'), t('order_detail.issue_fields_required'));
      return;
    }

    setIsSubmittingIssue(true);
    try {
      await reportOrderIssue(order.orderId, selectedIssueType, issueDescription);
      setShowIssueModal(false);
      setSelectedIssueType(null);
      setIssueDescription('');
      Alert.alert(t('common.success'), t('order_detail.issue_reported'));
    } catch (error) {
      Alert.alert(t('common.error'), t('order_detail.issue_report_failed'));
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const issueTypeLabels: Record<IssueType, string> = {
    CUSTOMER_UNAVAILABLE: t('order_detail.issue_customer_unavailable'),
    WRONG_ADDRESS: t('order_detail.issue_wrong_address'),
    RESTAURANT_DELAY: t('order_detail.issue_restaurant_delay'),
    ACCIDENT: t('order_detail.issue_accident'),
    VEHICLE_ISSUE: t('order_detail.issue_vehicle'),
    OTHER: t('order_detail.issue_other'),
  };

  // Pickup is blocked server-side until the restaurant marks the order READY
  // (sets readyAt). The courier can accept early and drive to the restaurant,
  // but the pickup slide stays disabled until the kitchen is done.
  const isOrderReady = !!order.readyAt || order.status === 'READY';

  const getButtonTitle = () => {
    switch (order.status) {
      case 'COURIER_ASSIGNED':
      case 'READY':
        return isOrderReady
          ? t('order_detail.slide_pickup')
          : t('order_detail.slide_pickup_waiting');
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        return t('order_detail.slide_delivery');
      default:
        return t('order_detail.order_completed');
    }
  };

  // Determine if order is active (needs navigation)
  const isActiveOrder = order.status === 'COURIER_ASSIGNED' || order.status === 'READY' || order.status === 'PICKED_UP' || order.status === 'IN_TRANSIT';
  const isGoingToPickup = order.status === 'COURIER_ASSIGNED' || order.status === 'READY';

  const handleOpenNavigator = () => {
    const lat = isGoingToPickup ? order.restaurantLat : order.deliveryLat;
    const lng = isGoingToPickup ? order.restaurantLng : order.deliveryLng;
    const name = isGoingToPickup ? (order.restaurantName ?? 'Pickup') : (order.customerName ?? 'Delivery');
    const address = isGoingToPickup ? restaurantAddress : deliveryAddr;
    const hasCoords = lat != null && lng != null && (lat !== 0 || lng !== 0);

    // Build the destination query: prefer coords, fall back to address text
    const destination = hasCoords
      ? `${lat},${lng}`
      : encodeURIComponent(address || name);
    const label = encodeURIComponent(name);

    const navigationUrls = hasCoords
      ? Platform.select({
          ios: [
            `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
            `waze://?ll=${lat},${lng}&navigate=yes`,
            `maps://?daddr=${lat},${lng}`,
          ],
          android: [
            `google.navigation:q=${lat},${lng}`,
            `waze://?ll=${lat},${lng}&navigate=yes`,
            `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
          ],
          default: [
            `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
          ],
        }) || []
      : Platform.select({
          ios: [
            `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
            `maps://?daddr=${destination}`,
          ],
          android: [
            `geo:0,0?q=${destination}`,
          ],
          default: [
            `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
          ],
        }) || [];

    const tryOpenUrl = async (urls: string[], index: number = 0) => {
      if (index >= urls.length) {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`);
        return;
      }
      try {
        const supported = await Linking.canOpenURL(urls[index]);
        if (supported) {
          await Linking.openURL(urls[index]);
        } else {
          tryOpenUrl(urls, index + 1);
        }
      } catch {
        tryOpenUrl(urls, index + 1);
      }
    };

    tryOpenUrl(navigationUrls);
  };

  const handleCallCustomer = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`);
    } else {
      Alert.alert(t('order_detail.call'), t('order_detail.no_phone', 'Phone number not available'));
    }
  };

  const handleCallRestaurant = () => {
    if (restaurantPhone) {
      Linking.openURL(`tel:${restaurantPhone}`);
    }
  };

  const renderContactButton = (icon: any, label: string, color: string, onPress: () => void) => (
    <TouchableOpacity style={[styles.contactButton, { backgroundColor: color + '15' }]} onPress={onPress}>
      <View style={[styles.contactIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.contactLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          <OrderMap order={order} />

          <View style={styles.paymentBadge}>
            <CreditCard size={14} color={order.isPaid ? Colors.success : Colors.accent} />
            <Text style={[styles.paymentText, { color: order.isPaid ? Colors.success : Colors.accent }]}>
              {order.isPaid ? t('order_detail.paid') : (order.paymentMethod ?? 'CASH')}
            </Text>
          </View>
        </View>

        {/* Action Card */}
        <View style={styles.card}>
          <View style={styles.locationSection}>
            <TouchableOpacity style={styles.timelineItem} onPress={handleCallRestaurant}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.primary }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationLabel}>{t('order_detail.pickup_label')}</Text>
                <Text style={styles.locationName}>{restaurantName}</Text>
                <Text style={styles.locationAddress}>{restaurantAddress}</Text>
                {restaurantPhone && (
                  <Text style={styles.phoneText}>{restaurantPhone}</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.accent }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationLabel}>{t('order_detail.dropoff_label')}</Text>
                <Text style={styles.locationName}>{customerName}</Text>
                <Text style={styles.locationAddress}>{deliveryAddr}</Text>
                {deliveryInstructions && (
                  <Text style={styles.instructionsText}>{deliveryInstructions}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.orderInfo}>
            <View style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <Package size={16} color={Colors.textLight} />
                <Text style={styles.infoLabel}>{t('order_detail.order_items')} ({itemCount})</Text>
              </View>
              {order.items?.map((item, index) => (
                <Text key={index} style={styles.infoValue}>• {item.quantity}x {item.name}</Text>
              )) ?? (
                <Text style={styles.infoValue}>{itemCount} {t('orders.items', 'items')}</Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>{t('order_detail.est_earnings')}</Text>
              <Text style={styles.earningsValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>

          {/* Cash to collect — cash-only MVP: courier collects order.total on
              delivery; the complete call records the payment server-side */}
          {!order.isPaid && isActiveOrder && (
            <>
              <View style={styles.divider} />
              <View style={styles.collectCashRow}>
                <Text style={styles.collectCashLabel}>{t('order_detail.collect_cash')}</Text>
                <Text style={styles.collectCashValue}>{formatCurrency(order.total ?? totalAmount)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Navigate Button — shown for active orders, or any order with valid coordinates */}
        {(isActiveOrder || order.restaurantLat || order.deliveryLat) && (
          <View style={styles.navigateContainer}>
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={handleOpenNavigator}
              activeOpacity={0.7}
            >
              <Navigation size={22} color={Colors.surface} />
              <Text style={styles.navigateButtonText}>{t('navigation.open_navigator')}</Text>
              <ExternalLink size={16} color={Colors.surface} />
            </TouchableOpacity>
          </View>
        )}

        {/* Contact Actions */}
        {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <>
            <View style={styles.contactRow}>
              {renderContactButton(<Phone size={20} color="white" />, t('order_detail.call'), Colors.primary, handleCallCustomer)}
            </View>
            <View style={styles.reportIssueContainer}>
              <TouchableOpacity
                style={styles.reportIssueButton}
                onPress={() => setShowIssueModal(true)}
              >
                <AlertTriangle size={18} color={Colors.danger} />
                <Text style={styles.reportIssueText}>{t('order_detail.report_issue')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Issue Report Modal */}
      <Modal
        visible={showIssueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('order_detail.report_issue')}</Text>
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{t('order_detail.issue_type')}</Text>
            <View style={styles.issueTypesGrid}>
              {(Object.keys(ISSUE_TYPES) as IssueType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.issueTypeButton,
                    selectedIssueType === type && styles.issueTypeButtonActive,
                  ]}
                  onPress={() => setSelectedIssueType(type)}
                >
                  <Text
                    style={[
                      styles.issueTypeText,
                      selectedIssueType === type && styles.issueTypeTextActive,
                    ]}
                  >
                    {issueTypeLabels[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('order_detail.issue_description')}</Text>
            <TextInput
              style={styles.issueInput}
              placeholder={t('order_detail.issue_description_placeholder')}
              placeholderTextColor={Colors.textLight}
              value={issueDescription}
              onChangeText={setIssueDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.submitIssueButton,
                (!selectedIssueType || !issueDescription.trim() || isSubmittingIssue) && styles.submitIssueButtonDisabled,
              ]}
              onPress={handleReportIssue}
              disabled={!selectedIssueType || !issueDescription.trim() || isSubmittingIssue}
            >
              {isSubmittingIssue ? (
                <ActivityIndicator color={Colors.surface} size="small" />
              ) : (
                <Text style={styles.submitIssueText}>{t('order_detail.submit_issue')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer Action */}
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
        <View style={styles.footer}>
          <SlideButton
            key={order.status}
            title={getButtonTitle()}
            onComplete={handleSlideComplete}
            disabled={isGoingToPickup && !isOrderReady}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backLink: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backLinkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mapContainer: {
    height: 300,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  paymentBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  locationSection: {
    position: 'relative',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 4,
    marginRight: 16,
    zIndex: 2,
    borderWidth: 3,
    borderColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 20,
    bottom: 40,
    width: 2,
    backgroundColor: Colors.border,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textLight,
    letterSpacing: 1,
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  phoneText: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 4,
  },
  instructionsText: {
    fontSize: 13,
    color: Colors.accent,
    fontStyle: 'italic',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemsSection: {
    flex: 1,
    marginRight: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.success,
  },
  collectCashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  collectCashLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  collectCashValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400E',
  },
  navigateContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  contactRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  reportIssueContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  reportIssueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.danger + '10',
    gap: 8,
  },
  reportIssueText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
  },
  issueTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issueTypeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  issueTypeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  issueTypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  issueTypeTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  issueInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitIssueButton: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitIssueButtonDisabled: {
    backgroundColor: Colors.border,
  },
  submitIssueText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
});

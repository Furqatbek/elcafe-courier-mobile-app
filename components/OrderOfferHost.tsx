import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OrderOfferModal } from '@/components/OrderOfferModal';
import { useCourier, type AvailableOrder } from '@/context/CourierContext';
import { soundService } from '@/services/soundService';
import logger from '@/lib/logger';

/**
 * Shows the new-order offer, from anywhere in the app.
 *
 * This lived inside app/(tabs)/orders.tsx, which meant the offer could only
 * appear on ONE of the app's 33 screens. A push arrived, the context state was
 * set, and nothing rendered — because the component that reads it was not
 * mounted. The courier saw a system notification and no offer.
 *
 * The screens where it failed are the ones that matter most: map-navigation,
 * where a courier sits for the whole of a delivery and is exactly who you want
 * to offer the next job to; the order detail screen; earnings; settings. Worse,
 * the offer was not lost but *deferred* — the state stayed set, so navigating
 * back to Orders minutes later popped a stale offer for an order somebody else
 * had long since taken.
 *
 * Mounted once at the root, inside CourierProvider. It renders nothing until
 * there is something to offer.
 *
 * It also owns the audio session (soundService.initialize), which was likewise
 * tab-scoped: the alert that tells a riding courier a job exists was only ever
 * configured while they were looking at the screen that would have shown it.
 */
export function OrderOfferHost() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    newOrderOffer,
    clearNewOrderOffer,
    availableOrders,
    acceptOrder,
    fetchAvailableOrders,
    currentLocation,
    orderTakenEvent,
    clearOrderTakenEvent,
    courierProfile,
    isOnline,
  } = useCourier();

  const [visible, setVisible] = useState(false);
  const [offerOrder, setOfferOrder] = useState<AvailableOrder | null>(null);
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const hasInitializedRef = useRef(false);

  // The audio session, configured once for the whole app rather than per tab.
  useEffect(() => {
    soundService.initialize();
    return () => {
      soundService.cleanup();
    };
  }, []);

  const showOffer = useCallback((order: AvailableOrder) => {
    logger.log('[OrderOfferHost] Showing offer for', order.orderId);
    setOfferOrder(order);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setOfferOrder(null);
    clearNewOrderOffer();
  }, [clearNewOrderOffer]);

  // A push or a socket event produced an offer.
  useEffect(() => {
    if (!newOrderOffer || !isOnline || visible) return;
    try {
      showOffer({
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
      } as AvailableOrder);
    } catch (error) {
      logger.error('[OrderOfferHost] Could not build the offer:', error);
    }
  }, [newOrderOffer, isOnline, visible, showOffer]);

  // The foreground poll noticed an order the courier has not been shown yet.
  // Push is the primary path, but this covers a push that was dropped by the
  // OEM's battery optimisation — which on Xiaomi and Huawei is routine.
  useEffect(() => {
    if (!isOnline) {
      previousOrderIdsRef.current = new Set();
      hasInitializedRef.current = false;
      return;
    }
    if (availableOrders.length === 0) return;

    const currentIds = new Set(availableOrders.map((o) => o.orderId));

    // First list after coming online is the backlog, not news.
    if (!hasInitializedRef.current) {
      previousOrderIdsRef.current = currentIds;
      hasInitializedRef.current = true;
      return;
    }

    const fresh = availableOrders.filter((o) => !previousOrderIdsRef.current.has(o.orderId));
    if (fresh.length > 0 && !visible) {
      showOffer(fresh[0]);
    }
    previousOrderIdsRef.current = currentIds;
  }, [availableOrders, isOnline, visible, showOffer]);

  // Another courier took the order while it was still on screen. Our own
  // accept broadcasts ORDER_TAKEN too, so ignore events carrying our id.
  useEffect(() => {
    if (!orderTakenEvent || !offerOrder || orderTakenEvent.orderId !== offerOrder.orderId) return;
    const myCourierId = courierProfile?.id;
    if (myCourierId != null && Number(orderTakenEvent.courierId) === Number(myCourierId)) return;

    logger.log('[OrderOfferHost] Offered order was taken, closing:', orderTakenEvent.orderId);
    dismiss();
    clearOrderTakenEvent();
  }, [orderTakenEvent, offerOrder, courierProfile, dismiss, clearOrderTakenEvent]);

  const handleAccept = useCallback(
    async (orderId: number) => {
      try {
        await acceptOrder(orderId);
        dismiss();
        router.push(`/map-navigation/${orderId}`);
      } catch (error: any) {
        const message: string = error?.message || '';
        if (
          message.includes('already has a courier assigned') ||
          message.includes('already assigned') ||
          message.includes('ORDER_TAKEN')
        ) {
          Alert.alert(
            t('available_orders.order_taken_title', 'Order No Longer Available'),
            t('available_orders.order_already_taken', 'This order was already taken by another courier.')
          );
          dismiss();
          fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
        } else {
          Alert.alert(t('common.error'), message || t('available_orders.accept_error'));
          // Re-throw so the modal knows the accept failed and can re-enable.
          throw error;
        }
      }
    },
    [acceptOrder, dismiss, router, t, fetchAvailableOrders, currentLocation]
  );

  if (!offerOrder) return null;

  return (
    <OrderOfferModal
      visible={visible}
      order={offerOrder}
      onAccept={handleAccept}
      onDecline={dismiss}
    />
  );
}

export default OrderOfferHost;

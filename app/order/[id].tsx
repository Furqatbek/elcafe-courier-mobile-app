import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Phone, MessageSquare, Navigation, ArrowLeft, CreditCard, Package } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DEFAULTS } from '@/constants/config';
import { useCourier, OrderStatus } from '@/context/CourierContext';
import { SlideButton } from '@/components/SlideButton';
import { StatusBadge } from '@/components/StatusBadge';
import OrderMap from '@/components/OrderMap';


export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus } = useCourier();
  const orderId = Number(id);
  const [order, setOrder] = useState(orders.find(o => o.orderId === orderId));

  useEffect(() => {
    setOrder(orders.find(o => o.orderId === orderId));
  }, [orders, orderId]);

  if (!order) {
    return (
      <View style={styles.container}>
        <Text>{t('order_detail.not_found')}</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ${DEFAULTS.CURRENCY_SYMBOL}`;
  };

  const handleSlideComplete = () => {
    let nextStatus: OrderStatus | null = null;

    if (order.status === 'ACCEPTED') nextStatus = 'PICKED_UP';
    else if (order.status === 'PICKED_UP') nextStatus = 'DELIVERING';
    else if (order.status === 'DELIVERING') nextStatus = 'DELIVERED';

    if (nextStatus) {
      updateOrderStatus(order.orderId, nextStatus);

      if (nextStatus === 'PICKED_UP') {
        router.push(`/map-navigation/${order.orderId}`);
      }

      if (nextStatus === 'DELIVERED') {
        // Navigate to rating screen after completing delivery
        router.replace(`/order-rating/${order.orderId}`);
      }
    }
  };

  const getButtonTitle = () => {
    switch (order.status) {
      case 'ACCEPTED': return t('order_detail.slide_pickup');
      case 'PICKED_UP': return t('order_detail.slide_delivery');
      case 'DELIVERING': return t('order_detail.slide_delivery');
      default: return t('order_detail.order_completed');
    }
  };

  const handleCallCustomer = () => {
    const phoneNumber = order.customer.phone;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert(t('order_detail.call'), t('order_detail.no_phone', 'Phone number not available'));
    }
  };

  const handleCallRestaurant = () => {
    const phoneNumber = order.restaurant.phone;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const handleChat = () => {
    router.push(`/chat?type=customer&orderId=${order.orderId}`);
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
        <Text style={styles.headerTitle}>{order.orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          <OrderMap order={order} />

          <View style={styles.paymentBadge}>
            <CreditCard size={14} color={order.isPaid ? Colors.success : Colors.accent} />
            <Text style={[styles.paymentText, { color: order.isPaid ? Colors.success : Colors.accent }]}>
              {order.isPaid ? t('order_detail.paid') : order.paymentMethod}
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
                <Text style={styles.locationName}>{order.restaurant.name}</Text>
                <Text style={styles.locationAddress}>{order.restaurant.address}</Text>
                {order.restaurant.phone && (
                  <Text style={styles.phoneText}>{order.restaurant.phone}</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.accent }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.locationLabel}>{t('order_detail.dropoff_label')}</Text>
                <Text style={styles.locationName}>{order.customer.name}</Text>
                <Text style={styles.locationAddress}>{order.deliveryAddress.fullAddress}</Text>
                {order.deliveryAddress.instructions && (
                  <Text style={styles.instructionsText}>{order.deliveryAddress.instructions}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.orderInfo}>
            <View style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <Package size={16} color={Colors.textLight} />
                <Text style={styles.infoLabel}>{t('order_detail.order_items')} ({order.items.length})</Text>
              </View>
              {order.items.map((item, index) => (
                <Text key={index} style={styles.infoValue}>• {item.quantity}x {item.name}</Text>
              ))}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>{t('order_detail.est_earnings')}</Text>
              <Text style={styles.earningsValue}>{formatCurrency(order.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Contact Actions */}
        {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <View style={styles.contactRow}>
            {renderContactButton(<Phone size={20} color="white" />, t('order_detail.call'), Colors.primary, handleCallCustomer)}
            {renderContactButton(<MessageSquare size={20} color="white" />, t('order_detail.chat'), Colors.secondary, handleChat)}
          </View>
        )}
      </ScrollView>

      {/* Footer Action */}
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
        <View style={styles.footer}>
          <SlideButton
            key={order.status}
            title={getButtonTitle()}
            onComplete={handleSlideComplete}
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
});

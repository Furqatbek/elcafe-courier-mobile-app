import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MapPin, Clock, DollarSign } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Order } from '@/context/CourierContext';
import { StatusBadge } from './StatusBadge';
import { useRouter } from 'expo-router';

interface OrderCardProps {
  order: Order;
  showActions?: boolean;
}

export function OrderCard({ order, showActions = true }: OrderCardProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/order/${order.id}`);
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9} 
      onPress={handlePress}
    >
      <View style={styles.header}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {order.restaurantName}
        </Text>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.row}>
        <MapPin size={16} color={Colors.textLight} />
        <Text style={styles.address} numberOfLines={1}>
          {order.restaurantAddress}
        </Text>
      </View>
      
      {/* Dashed line connector simulation could go here */}
      
      <View style={[styles.row, { marginTop: 4 }]}>
        <MapPin size={16} color={Colors.primary} />
        <Text style={styles.address} numberOfLines={1}>
          {order.customerAddress}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <DollarSign size={16} color={Colors.primary} />
          <Text style={styles.infoText}>${(order.deliveryFee + order.tip).toFixed(2)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Clock size={16} color={Colors.textLight} />
          <Text style={styles.infoText}>{order.estimatedTime}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.distance}>{order.distance}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  address: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.background,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  distance: {
    fontSize: 14,
    color: Colors.textLight,
  },
});

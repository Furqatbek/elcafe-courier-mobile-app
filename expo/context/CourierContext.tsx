import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/config';
import createContextHook from '@nkzw/create-context-hook';
import { useMemo, useState, useEffect } from 'react';

export type OrderStatus = 'pending' | 'pickup' | 'delivery' | 'completed';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  licenseNumber?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  active: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    user: User;
  };
  timestamp: string;
}

export interface Order {
  id: string;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  customerAddress: string;
  deliveryFee: number;
  tip: number;
  status: OrderStatus;
  distance: string;
  estimatedTime: string;
  createdAt: string;
  items: string[];
  pickupLocation: {
    latitude: number;
    longitude: number;
  };
  dropoffLocation: {
    latitude: number;
    longitude: number;
  };
  routeCoordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export interface DriverStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedOrders: number;
  rating: number;
}

const MOCK_ORDERS: Order[] = [
  {
    id: '101',
    restaurantName: 'Burger King',
    restaurantAddress: '123 Main St, New York',
    customerName: 'John Doe',
    customerAddress: '456 Broadway, New York',
    deliveryFee: 5.50,
    tip: 2.00,
    status: 'pending',
    distance: '2.5 km',
    estimatedTime: '15 min',
    createdAt: new Date().toISOString(),
    items: ['Whopper Meal', 'Coke'],
    pickupLocation: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
    dropoffLocation: {
      latitude: 40.7282,
      longitude: -73.9942,
    },
    routeCoordinates: [
      { latitude: 40.7128, longitude: -74.0060 },
      { latitude: 40.7138, longitude: -74.0060 },
      { latitude: 40.7138, longitude: -74.0020 },
      { latitude: 40.7200, longitude: -74.0020 },
      { latitude: 40.7200, longitude: -73.9980 },
      { latitude: 40.7282, longitude: -73.9980 },
      { latitude: 40.7282, longitude: -73.9942 },
    ],
  },
  {
    id: '102',
    restaurantName: 'Sushi Place',
    restaurantAddress: '789 5th Ave, New York',
    customerName: 'Alice Smith',
    customerAddress: '101 Park Ave, New York',
    deliveryFee: 8.75,
    tip: 4.50,
    status: 'pickup',
    distance: '4.2 km',
    estimatedTime: '25 min',
    createdAt: new Date().toISOString(),
    items: ['Spicy Tuna Roll', 'Miso Soup'],
    pickupLocation: {
      latitude: 40.7589,
      longitude: -73.9851,
    },
    dropoffLocation: {
      latitude: 40.7484,
      longitude: -73.9857,
    },
    routeCoordinates: [
      { latitude: 40.7589, longitude: -73.9851 },
      { latitude: 40.7550, longitude: -73.9851 },
      { latitude: 40.7550, longitude: -73.9880 },
      { latitude: 40.7500, longitude: -73.9880 },
      { latitude: 40.7500, longitude: -73.9857 },
      { latitude: 40.7484, longitude: -73.9857 },
    ],
  },
  {
    id: '103',
    restaurantName: 'Pizza Hut',
    restaurantAddress: '555 West St, New York',
    customerName: 'Bob Brown',
    customerAddress: '222 East St, New York',
    deliveryFee: 6.00,
    tip: 0,
    status: 'completed',
    distance: '3.0 km',
    estimatedTime: '20 min',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    items: ['Pepperoni Pizza'],
    pickupLocation: {
      latitude: 40.7308,
      longitude: -74.0020,
    },
    dropoffLocation: {
      latitude: 40.7410,
      longitude: -73.9990,
    },
    routeCoordinates: [
      { latitude: 40.7308, longitude: -74.0020 },
      { latitude: 40.7350, longitude: -74.0020 },
      { latitude: 40.7350, longitude: -73.9990 },
      { latitude: 40.7410, longitude: -73.9990 },
    ],
  }
];

export const [CourierProvider, useCourier] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [stats, setStats] = useState<DriverStats>({
    todayEarnings: 45.50,
    weekEarnings: 320.00,
    monthEarnings: 1250.00,
    completedOrders: 145,
    rating: 4.9,
  });

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('accessToken');
        const storedUser = await AsyncStorage.getItem('user');
        const storedRefresh = await AsyncStorage.getItem('refreshToken');
        
        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to restore session', e);
      }
    };
    
    restoreSession();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const isDevelopment = __DEV__ || !BASE_URL;

    if (isDevelopment) {
      console.log('Development mode: bypassing authentication');
      
      const mockUser: User = {
        id: 1,
        email: email,
        firstName: 'Test',
        lastName: 'Courier',
        role: 'courier',
        phone: '+1234567890',
        vehicleType: 'car',
        vehiclePlate: 'ABC123',
        licenseNumber: 'DL12345',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Camry',
        active: true,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };

      const mockToken = 'dev-mock-token-' + Date.now();
      
      setAccessToken(mockToken);
      setRefreshToken(mockToken);
      setUser(mockUser);
      
      await AsyncStorage.setItem('accessToken', mockToken);
      await AsyncStorage.setItem('refreshToken', mockToken);
      await AsyncStorage.setItem('user', JSON.stringify(mockUser));
      
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let data: LoginResponse;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse login response:', text);
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (data.success) {
        setAccessToken(data.data.accessToken);
        setRefreshToken(data.data.refreshToken);
        setUser(data.data.user);
        
        await AsyncStorage.setItem('accessToken', data.data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.data.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.data.user));
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
  };

  const toggleOnline = () => setIsOnline(prev => !prev);

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'completed'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    
    // Simple logic to simulate earning update on completion
    if (status === 'completed') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setStats(prev => ({
          ...prev,
          todayEarnings: prev.todayEarnings + order.deliveryFee + order.tip,
          completedOrders: prev.completedOrders + 1
        }));
      }
    }
  };

  return {
    user,
    accessToken,
    login,
    logout,
    isOnline,
    toggleOnline,
    orders,
    activeOrders,
    completedOrders,
    stats,
    updateOrderStatus
  };
});

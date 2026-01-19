import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG, ORDER_STATUS_CONFIG } from '@/constants/config';
import createContextHook from '@nkzw/create-context-hook';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

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

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
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

const DEFAULT_STATS: DriverStats = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  completedOrders: 0,
  rating: 0,
};

export const [CourierProvider, useCourier] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DriverStats>(DEFAULT_STATS);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  // Refresh access token using refresh token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const currentRefreshToken = refreshTokenRef.current;
    if (!currentRefreshToken || isRefreshing) {
      return null;
    }

    setIsRefreshing(true);

    try {
      const isDevelopment = __DEV__ || !BASE_URL;

      if (isDevelopment) {
        // In development, just extend the mock token
        const newToken = 'dev-mock-token-' + Date.now();
        setAccessToken(newToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, newToken);
        return newToken;
      }

      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      const data: RefreshTokenResponse = await response.json();

      if (data.success) {
        setAccessToken(data.data.accessToken);
        setRefreshToken(data.data.refreshToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, data.data.accessToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, data.data.refreshToken);
        return data.data.accessToken;
      }

      // Refresh failed, log user out
      await logout();
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Helper function for authenticated API requests
  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = accessTokenRef.current;
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    // If unauthorized, try to refresh token
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        return fetch(`${BASE_URL}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${refreshed}`,
            ...options.headers,
          },
        });
      }
      throw new Error('Session expired');
    }

    return response;
  }, [refreshAccessToken]);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    const isDevelopment = __DEV__ || !BASE_URL;

    if (isDevelopment) {
      // Use mock data in development
      setOrders(MOCK_ORDERS);
      return;
    }

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.ORDERS);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      // Keep existing orders on error
    }
  }, [authenticatedFetch]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    const isDevelopment = __DEV__ || !BASE_URL;

    if (isDevelopment) {
      // Use calculated stats from orders in development
      const completedOrdersList = orders.filter(o => o.status === 'completed');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const todayOrders = completedOrdersList.filter(o => new Date(o.createdAt) >= todayStart);
      const weekOrders = completedOrdersList.filter(o => new Date(o.createdAt) >= weekStart);
      const monthOrders = completedOrdersList.filter(o => new Date(o.createdAt) >= monthStart);

      setStats({
        todayEarnings: todayOrders.reduce((sum, o) => sum + o.deliveryFee + o.tip, 0),
        weekEarnings: weekOrders.reduce((sum, o) => sum + o.deliveryFee + o.tip, 0),
        monthEarnings: monthOrders.reduce((sum, o) => sum + o.deliveryFee + o.tip, 0),
        completedOrders: completedOrdersList.length,
        rating: 4.9, // Mock rating
      });
      return;
    }

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.STATS);
      const data = await response.json();

      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [authenticatedFetch, orders]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!user) return;

    await Promise.all([
      fetchOrders(),
      fetchStats(),
    ]);
  }, [user, fetchOrders, fetchStats]);

  // Logout function
  const logout = useCallback(async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setOrders([]);
    setStats(DEFAULT_STATS);
    setIsOnline(false);
    hasLoadedInitialData.current = false;

    await AsyncStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.USER_KEY);
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(TOKEN_CONFIG.USER_KEY);
        const storedRefresh = await AsyncStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to restore session', e);
      } finally {
        setIsSessionLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Load initial data when user is authenticated
  useEffect(() => {
    if (user && !hasLoadedInitialData.current) {
      hasLoadedInitialData.current = true;
      refreshData();
    }
  }, [user, refreshData]);

  // Set up auto-refresh for orders when online
  useEffect(() => {
    if (isOnline && user) {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      // Set up new interval
      refreshIntervalRef.current = setInterval(() => {
        fetchOrders();
      }, ORDER_STATUS_CONFIG.REFRESH_INTERVAL);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOnline, user, fetchOrders]);

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
      hasLoadedInitialData.current = false; // Reset so data loads

      await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, mockToken);
      await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, mockToken);
      await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(mockUser));

      return;
    }

    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
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
        hasLoadedInitialData.current = false; // Reset so data loads

        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, data.data.accessToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, data.data.refreshToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(data.data.user));
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const toggleOnline = () => setIsOnline(prev => !prev);

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'completed'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    // Optimistically update local state
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

    // In production, also update on server
    const isDevelopment = __DEV__ || !BASE_URL;
    if (!isDevelopment) {
      try {
        let endpoint = '';
        switch (status) {
          case 'pickup':
            endpoint = API_ENDPOINTS.ORDERS.ACCEPT(orderId);
            break;
          case 'delivery':
            endpoint = API_ENDPOINTS.ORDERS.PICKUP(orderId);
            break;
          case 'completed':
            endpoint = API_ENDPOINTS.ORDERS.COMPLETE(orderId);
            break;
        }

        if (endpoint) {
          await authenticatedFetch(endpoint, { method: 'POST' });
        }
      } catch (error) {
        console.error('Failed to update order status on server:', error);
        // Optionally revert optimistic update
      }
    }
  };

  // Check if user is authenticated (for navigation)
  const isAuthenticated = useMemo(() => !!user && !!accessToken, [user, accessToken]);

  return {
    user,
    accessToken,
    isAuthenticated,
    isSessionLoading,
    login,
    logout,
    isOnline,
    toggleOnline,
    orders,
    activeOrders,
    completedOrders,
    stats,
    updateOrderStatus,
    refreshData,
    refreshAccessToken,
  };
});

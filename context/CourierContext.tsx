import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG, ORDER_CONFIG, LOCATION_CONFIG } from '@/constants/config';
import createContextHook from '@nkzw/create-context-hook';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
export type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

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

export interface CourierProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  vehicleType: 'BICYCLE' | 'MOTORCYCLE' | 'CAR';
  vehicleNumber?: string;
  licenseNumber?: string;
  status: CourierStatus;
  verificationStatus: VerificationStatus;
  rating: number;
  totalDeliveries: number;
  preferredRadius: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  data?: {
    otpId: string;
    expiresAt: string;
  };
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: User;
    courier?: CourierProfile;
    isNewUser: boolean;
  };
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

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  restaurant: {
    id: number;
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  customer: {
    name: string;
    phone: string;
  };
  deliveryAddress: {
    fullAddress: string;
    latitude: number;
    longitude: number;
    instructions?: string;
  };
  items: OrderItem[];
  paymentMethod: 'CASH' | 'CARD';
  isPaid: boolean;
  totalAmount: number;
  createdAt?: string;
}

export interface DriverStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedOrders: number;
  rating: number;
}

// Available order from GET /couriers/me/available-orders
export interface AvailableOrder {
  orderId: number;
  orderNumber: string;
  restaurant: {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance: number;
  };
  deliveryAddress: {
    fullAddress: string;
    latitude: number;
    longitude: number;
    distance: number;
  };
  estimatedDistance: number;
  estimatedEarnings: number;
  itemCount: number;
  createdAt: string;
}

const DEFAULT_STATS: DriverStats = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  completedOrders: 0,
  rating: 0,
};

export const [CourierProvider, useCourier] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [courierProfile, setCourierProfile] = useState<CourierProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DriverStats>(DEFAULT_STATS);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [isLoadingAvailableOrders, setIsLoadingAvailableOrders] = useState(false);

  // Track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
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
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.ACTIVE_ORDERS);
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
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.EARNINGS);
      const data = await response.json();

      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [authenticatedFetch]);

  // Fetch available orders nearby
  const fetchAvailableOrders = useCallback(async (lat?: number, lng?: number, radiusKm?: number) => {
    setIsLoadingAvailableOrders(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (lat !== undefined) params.append('lat', lat.toString());
      if (lng !== undefined) params.append('lng', lng.toString());
      if (radiusKm !== undefined) params.append('radiusKm', radiusKm.toString());

      const queryString = params.toString();
      const endpoint = queryString
        ? `${API_ENDPOINTS.COURIER.AVAILABLE_ORDERS}?${queryString}`
        : API_ENDPOINTS.COURIER.AVAILABLE_ORDERS;

      const response = await authenticatedFetch(endpoint);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setAvailableOrders(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch available orders:', error);
    } finally {
      setIsLoadingAvailableOrders(false);
    }
  }, [authenticatedFetch]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!user) return;

    await Promise.all([
      fetchOrders(),
      fetchStats(),
      fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude),
    ]);
  }, [user, fetchOrders, fetchStats, fetchAvailableOrders, currentLocation]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsLocationTracking(false);
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Stop location tracking
    await stopLocationTracking();

    setUser(null);
    setCourierProfile(null);
    setAccessToken(null);
    setRefreshToken(null);
    setOrders([]);
    setStats(DEFAULT_STATS);
    setIsOnline(false);
    setCurrentLocation(null);
    hasLoadedInitialData.current = false;

    await AsyncStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.USER_KEY);
    await AsyncStorage.removeItem('courier_profile');
  }, [stopLocationTracking]);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(TOKEN_CONFIG.USER_KEY);
        const storedRefresh = await AsyncStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
        const storedProfile = await AsyncStorage.getItem('courier_profile');

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));

          if (storedProfile) {
            setCourierProfile(JSON.parse(storedProfile));
          }
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

      // Fetch available orders immediately when going online
      fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);

      // Set up new interval
      refreshIntervalRef.current = setInterval(() => {
        fetchOrders();
        fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
      }, ORDER_CONFIG.REFRESH_INTERVAL);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOnline, user, fetchOrders, fetchAvailableOrders, currentLocation]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrPhone: email, password }),
      });

      const text = await response.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse login response:', text);
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (data.success) {
        // Save tokens first
        const accessToken = data.data.accessToken;
        const refreshToken = data.data.refreshToken;

        setAccessToken(accessToken);
        setRefreshToken(refreshToken);

        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, accessToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, refreshToken);

        // Fetch courier profile using the new token
        try {
          const profileResponse = await fetch(`${BASE_URL}${API_ENDPOINTS.COURIER.ME}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          const profileData = await profileResponse.json();

          if (profileData.success && profileData.data) {
            // Use courier profile data to construct user
            const profile = profileData.data;
            const nameParts = (profile.userName || '').split(' ');

            const user: User = {
              id: profile.userId,
              email: profile.email || data.data.email,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              role: 'COURIER',
              phone: profile.phone,
              vehicleType: profile.vehicleType,
              vehiclePlate: profile.vehicleNumber,
              active: profile.verified,
              emailVerified: true,
              createdAt: profile.verifiedAt || new Date().toISOString(),
            };

            setUser(user);
            setCourierProfile(profile);

            await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(user));
            await AsyncStorage.setItem('courier_profile', JSON.stringify(profile));
          } else {
            // Fallback: use login response data if courier profile fails
            const nameParts = (data.data.fullName || '').split(' ');
            const user: User = {
              id: data.data.userId,
              email: data.data.email,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              role: Array.isArray(data.data.roles) ? data.data.roles[0] || 'COURIER' : 'COURIER',
              active: true,
              emailVerified: true,
              createdAt: new Date().toISOString(),
            };

            setUser(user);
            await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(user));
          }
        } catch (profileError) {
          console.error('Failed to fetch courier profile:', profileError);
          // Fallback: use login response data
          const nameParts = (data.data.fullName || '').split(' ');
          const user: User = {
            id: data.data.userId,
            email: data.data.email,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            role: Array.isArray(data.data.roles) ? data.data.roles[0] || 'COURIER' : 'COURIER',
            active: true,
            emailVerified: true,
            createdAt: new Date().toISOString(),
          };

          setUser(user);
          await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(user));
        }

        hasLoadedInitialData.current = false; // Reset so data loads
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Request OTP for phone login
  const requestOtp = async (phone: string): Promise<OtpRequestResponse> => {
    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.PHONE_REQUEST_OTP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Request OTP error:', error);
      throw error;
    }
  };

  // Verify OTP and login
  const verifyOtp = async (phone: string, otp: string): Promise<OtpVerifyResponse> => {
    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.PHONE_VERIFY_OTP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      const data: OtpVerifyResponse = await response.json();

      if (data.success && data.data) {
        setAccessToken(data.data.accessToken);
        setRefreshToken(data.data.refreshToken);
        setUser(data.data.user);
        if (data.data.courier) {
          setCourierProfile(data.data.courier);
          await AsyncStorage.setItem('courier_profile', JSON.stringify(data.data.courier));
        }
        hasLoadedInitialData.current = false;

        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, data.data.accessToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, data.data.refreshToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      console.error('Verify OTP error:', error);
      throw error;
    }
  };

  // Fetch courier profile
  const fetchCourierProfile = useCallback(async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.ME);
      const data = await response.json();

      if (data.success && data.data) {
        setCourierProfile(data.data);
        await AsyncStorage.setItem('courier_profile', JSON.stringify(data.data));
        return data.data;
      }
    } catch (error) {
      console.error('Failed to fetch courier profile:', error);
    }
    return null;
  }, [authenticatedFetch]);

  // Update courier status (OFFLINE/AVAILABLE/BUSY/ON_BREAK)
  const updateCourierStatus = useCallback(async (status: CourierStatus) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.UPDATE_STATUS, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.success) {
        setCourierProfile(prev => prev ? { ...prev, status } : null);
        setIsOnline(status === 'AVAILABLE' || status === 'BUSY');
      }
    } catch (error) {
      console.error('Failed to update courier status:', error);
      throw error;
    }
  }, [authenticatedFetch]);

  // Update courier location to server
  const updateLocationOnServer = useCallback(async (
    latitude: number,
    longitude: number,
    accuracy?: number,
    heading?: number,
    speed?: number
  ) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.COURIER.UPDATE_LOCATION, {
        method: 'PUT',
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
        }),
      });
      setCurrentLocation({ latitude, longitude });
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, [authenticatedFetch]);

  // Start location tracking
  // Best practices: Idle (AVAILABLE) = 30s, Active Delivery = 5-10s, Moving Fast = 3-5s
  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    // Stop any existing subscription
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
    }

    // Determine update interval based on whether courier has active orders
    const hasActiveOrders = orders.some(o => o.status !== 'completed');
    const timeInterval = hasActiveOrders
      ? LOCATION_CONFIG.ACTIVE_INTERVAL  // 5 seconds during active delivery
      : LOCATION_CONFIG.IDLE_INTERVAL;   // 30 seconds when idle

    // Start watching location
    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: LOCATION_CONFIG.DISTANCE_FILTER,
        timeInterval,
      },
      (location) => {
        const { latitude, longitude, accuracy, heading, speed } = location.coords;
        updateLocationOnServer(
          latitude,
          longitude,
          accuracy ?? undefined,
          heading ?? undefined,
          speed ?? undefined
        );
      }
    );

    setIsLocationTracking(true);
  }, [updateLocationOnServer, orders]);

  const toggleOnline = async () => {
    const newStatus: CourierStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';
    await updateCourierStatus(newStatus);

    if (newStatus === 'AVAILABLE') {
      await startLocationTracking();
    } else {
      await stopLocationTracking();
    }
  };

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'DELIVERED'), [orders]);

  // Accept an available order
  const acceptOrder = useCallback(async (orderId: number | string) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.ACCEPT(orderId), {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Remove from available orders
        setAvailableOrders(prev => prev.filter(o => o.orderId !== orderId));

        // Add accepted order to active orders
        const acceptedOrder: Order = data.data;
        setOrders(prev => [acceptedOrder, ...prev]);

        // Update courier status to BUSY since they have an active order
        setCourierProfile(prev => prev ? { ...prev, status: 'BUSY' } : null);

        return acceptedOrder;
      } else {
        throw new Error(data.message || 'Failed to accept order');
      }
    } catch (error) {
      console.error('Failed to accept order:', error);
      throw error;
    }
  }, [authenticatedFetch]);

  const updateOrderStatus = async (orderId: number | string, status: OrderStatus) => {
    // Optimistically update local state
    setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status } : o));

    // Update on server
    try {
      let endpoint = '';
      let method = 'PUT';

      switch (status) {
        case 'PICKED_UP':
          // Picked up from restaurant - PUT
          endpoint = API_ENDPOINTS.ORDERS.PICKUP(orderId);
          method = 'PUT';
          break;
        case 'DELIVERING':
          // On the way to customer
          endpoint = API_ENDPOINTS.ORDERS.PICKUP(orderId);
          method = 'PUT';
          break;
        case 'DELIVERED':
          // Complete delivery - POST
          endpoint = API_ENDPOINTS.ORDERS.COMPLETE(orderId);
          method = 'POST';
          break;
      }

      if (endpoint) {
        await authenticatedFetch(endpoint, { method });
      }

      // Refresh stats and set status back to AVAILABLE after delivery completed
      if (status === 'DELIVERED') {
        await fetchStats();
        // Check if there are more active orders
        const remainingActive = orders.filter(o =>
          o.orderId !== orderId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        );
        if (remainingActive.length === 0) {
          setCourierProfile(prev => prev ? { ...prev, status: 'AVAILABLE' } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update order status on server:', error);
      // Revert optimistic update on error
      await fetchOrders();
    }
  };

  // Check if user is authenticated (for navigation)
  const isAuthenticated = useMemo(() => !!user && !!accessToken, [user, accessToken]);

  return {
    // User and authentication
    user,
    accessToken,
    isAuthenticated,
    isSessionLoading,
    login,
    logout,
    requestOtp,
    verifyOtp,

    // Courier profile
    courierProfile,
    fetchCourierProfile,
    updateCourierStatus,

    // Online status and location
    isOnline,
    toggleOnline,
    currentLocation,
    isLocationTracking,
    startLocationTracking,
    stopLocationTracking,
    updateLocationOnServer,

    // Orders
    orders,
    activeOrders,
    completedOrders,
    updateOrderStatus,

    // Available orders (nearby orders to accept)
    availableOrders,
    isLoadingAvailableOrders,
    fetchAvailableOrders,
    acceptOrder,

    // Stats
    stats,

    // Data refresh
    refreshData,
    refreshAccessToken,
  };
});

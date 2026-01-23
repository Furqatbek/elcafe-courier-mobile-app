import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG, ORDER_CONFIG, LOCATION_CONFIG, IssueType, WEBSOCKET_CONFIG } from '@/constants/config';
import createContextHook from '@nkzw/create-context-hook';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import websocketService, { NewOrderNotification, OrderStatusUpdate, WebSocketNotification } from '@/services/websocket';

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED';
export type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

// Re-export IssueType from config for convenience
export type { IssueType } from '@/constants/config';

// Re-export WebSocket types for convenience
export type { NewOrderNotification, OrderStatusUpdate, WebSocketNotification } from '@/services/websocket';

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
  id: number | string;
  userId: number | string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  vehicleType: 'BICYCLE' | 'MOTORCYCLE' | 'CAR';
  vehicleNumber?: string;
  licenseNumber?: string;
  status: CourierStatus;
  // API returns 'verified' boolean
  verified?: boolean;
  verifiedAt?: string;
  // Legacy field - some APIs may return this instead
  verificationStatus?: VerificationStatus;
  // Location
  currentLat?: number;
  currentLng?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  preferredRadiusKm?: number;
  preferredRadius?: number;
  // Stats
  rating?: number;
  averageRating?: number;
  totalDeliveries: number;
  currentOrderCount?: number;
  maxConcurrentOrders?: number;
  createdAt?: string;
  updatedAt?: string;
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
  externalOrderNo: string;
  status: OrderStatus;
  restaurantId: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  customerName: string;
  customerPhone: string;
  deliveryInstructions?: string;
  deliveryFee: number;
  tipAmount: number;
  total: number;
  itemCount: number;
  createdAt: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  // Legacy fields for backward compatibility
  orderNumber?: string;
  items?: OrderItem[];
  paymentMethod?: 'CASH' | 'CARD';
  isPaid?: boolean;
  totalAmount?: number;
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
  externalOrderNo: string;
  restaurantId: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  customerName: string;
  customerPhone: string;
  deliveryInstructions?: string;
  status: string;
  deliveryFee: number;
  tipAmount: number;
  total: number;
  itemCount: number;
  createdAt: string;
  readyAt?: string;
  // Calculated fields (optional, computed on frontend)
  estimatedDistance?: number;
  pickupDistance?: number;
}

// Earnings period type
export type EarningsPeriod = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

// Earnings breakdown item
export interface EarningsBreakdownItem {
  date: string;
  earnings: number;
  deliveries: number;
}

// Earnings summary from GET /couriers/me/earnings
export interface EarningsSummary {
  period: EarningsPeriod;
  totalEarnings: number;
  deliveryFees: number;
  tips: number;
  totalDeliveries: number;
  avgPerDelivery: number;
  onlineHours: number;
  breakdown: EarningsBreakdownItem[];
}

const DEFAULT_EARNINGS: EarningsSummary = {
  period: 'THIS_WEEK',
  totalEarnings: 0,
  deliveryFees: 0,
  tips: 0,
  totalDeliveries: 0,
  avgPerDelivery: 0,
  onlineHours: 0,
  breakdown: [],
};

// Pagination info for order history
export interface HistoryPagination {
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  hasMore: boolean;
}

const DEFAULT_HISTORY_PAGINATION: HistoryPagination = {
  page: 0,
  size: 10,
  totalPages: 0,
  totalElements: 0,
  hasMore: false,
};

// Notification type
export type NotificationType =
  | 'NEW_ORDER_NEARBY'
  | 'ORDER_ASSIGNED'
  | 'ORDER_CANCELLED'
  | 'PAYOUT_ISSUED'
  | 'VERIFICATION_APPROVED'
  | 'RATING_RECEIVED';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    orderId?: number;
    [key: string]: any;
  };
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
  const [earnings, setEarnings] = useState<EarningsSummary>(DEFAULT_EARNINGS);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('THIS_WEEK');
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPagination, setHistoryPagination] = useState<HistoryPagination>(DEFAULT_HISTORY_PAGINATION);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // WebSocket state
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [newOrderOffer, setNewOrderOffer] = useState<NewOrderNotification | null>(null);
  const wsUnsubscribeRefs = useRef<(() => void)[]>([]);

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

  // Fetch earnings from API with period support
  const fetchEarnings = useCallback(async (
    period: EarningsPeriod = 'THIS_WEEK',
    startDate?: string,
    endDate?: string
  ) => {
    setIsLoadingEarnings(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('period', period);
      if (period === 'CUSTOM' && startDate) params.append('startDate', startDate);
      if (period === 'CUSTOM' && endDate) params.append('endDate', endDate);

      const queryString = params.toString();
      const endpoint = `${API_ENDPOINTS.COURIER.EARNINGS}?${queryString}`;

      const response = await authenticatedFetch(endpoint);
      const data = await response.json();

      if (data.success && data.data) {
        // Ensure breakdown is always an array to prevent undefined errors
        setEarnings({
          ...DEFAULT_EARNINGS,
          ...data.data,
          breakdown: data.data.breakdown || [],
        });
        setEarningsPeriod(period);

        // Also update legacy stats for backward compatibility
        setStats(prev => ({
          ...prev,
          todayEarnings: period === 'TODAY' ? data.data.totalEarnings : prev.todayEarnings,
          weekEarnings: period === 'THIS_WEEK' ? data.data.totalEarnings : prev.weekEarnings,
          monthEarnings: period === 'THIS_MONTH' ? data.data.totalEarnings : prev.monthEarnings,
          completedOrders: data.data.totalDeliveries,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setIsLoadingEarnings(false);
    }
  }, [authenticatedFetch]);

  // Legacy alias for backward compatibility
  const fetchStats = useCallback(async () => {
    await fetchEarnings('THIS_WEEK');
  }, [fetchEarnings]);

  // Fetch order history with pagination
  const fetchOrderHistory = useCallback(async (
    page: number = 0,
    size: number = 10,
    dateFrom?: string,
    dateTo?: string,
    append: boolean = false
  ) => {
    setIsLoadingHistory(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('size', size.toString());
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const queryString = params.toString();
      const endpoint = `${API_ENDPOINTS.COURIER.ORDER_HISTORY}?${queryString}`;

      const response = await authenticatedFetch(endpoint);
      const data = await response.json();

      if (data.success && data.data) {
        const historyData = data.data;
        const orders = historyData.content || historyData.orders || historyData;

        if (append) {
          setOrderHistory(prev => [...prev, ...orders]);
        } else {
          setOrderHistory(orders);
        }

        // Update pagination info
        setHistoryPagination({
          page: historyData.number ?? page,
          size: historyData.size ?? size,
          totalPages: historyData.totalPages ?? 1,
          totalElements: historyData.totalElements ?? orders.length,
          hasMore: historyData.number < (historyData.totalPages - 1),
        });
      }
    } catch (error) {
      console.error('Failed to fetch order history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [authenticatedFetch]);

  // Load more history (for infinite scroll)
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingHistory || !historyPagination.hasMore) return;
    await fetchOrderHistory(historyPagination.page + 1, historyPagination.size, undefined, undefined, true);
  }, [fetchOrderHistory, historyPagination, isLoadingHistory]);

  // Fetch single order details
  const fetchOrderDetails = useCallback(async (orderId: number | string): Promise<Order | null> => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.DETAIL(orderId));
      const data = await response.json();

      if (data.success && data.data) {
        return data.data as Order;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      return null;
    }
  }, [authenticatedFetch]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.LIST);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setNotifications(data.data);
        // Update unread count based on fetched notifications
        const unread = data.data.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [authenticatedFetch]);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
      const data = await response.json();

      if (data.success && data.data !== undefined) {
        setUnreadCount(data.data.count ?? data.data);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [authenticatedFetch]);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {
        method: 'PUT',
      });
      const data = await response.json();

      if (data.success) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
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
      fetchUnreadCount(),
    ]);
  }, [user, fetchOrders, fetchStats, fetchAvailableOrders, fetchUnreadCount, currentLocation]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsLocationTracking(false);
  }, []);

  // WebSocket connection management
  const connectWebSocket = useCallback((token: string) => {
    // Set up event handlers
    websocketService.onConnected(() => {
      console.log('[CourierContext] WebSocket connected');
      setIsWebSocketConnected(true);
    });

    websocketService.onDisconnected(() => {
      console.log('[CourierContext] WebSocket disconnected');
      setIsWebSocketConnected(false);
    });

    websocketService.onError((error) => {
      console.error('[CourierContext] WebSocket error:', error);
      setIsWebSocketConnected(false);
    });

    // Connect to WebSocket
    websocketService.connect(token);
  }, []);

  const disconnectWebSocket = useCallback(() => {
    // Unsubscribe from all topics
    wsUnsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    wsUnsubscribeRefs.current = [];

    // Disconnect
    websocketService.disconnect();
    setIsWebSocketConnected(false);
    setNewOrderOffer(null);
  }, []);

  // Subscribe to WebSocket topics
  const subscribeToWebSocketTopics = useCallback(() => {
    // Clear existing subscriptions
    wsUnsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    wsUnsubscribeRefs.current = [];

    // Subscribe to new orders
    const unsubNewOrders = websocketService.subscribeToNewOrders((notification) => {
      try {
        console.log('[CourierContext] *** NEW CODE v4 *** New order received:', JSON.stringify(notification, null, 2));
        console.log('[CourierContext] Keys in notification:', Object.keys(notification));
        console.log('[CourierContext] restaurantName:', notification.restaurantName);
        console.log('[CourierContext] Has restaurant object?:', 'restaurant' in notification, (notification as any).restaurant);

        setNewOrderOffer(notification);
        // Also add to available orders list
        setAvailableOrders((prev) => {
          try {
            // Check if order already exists
            if (prev.some((o) => o.orderId === notification.orderId)) {
              return prev;
            }
            // Create an AvailableOrder from the notification
            // WebSocket now sends flat structure matching AvailableOrder
            const newOrder: AvailableOrder = {
              orderId: notification.orderId,
              externalOrderNo: notification.externalOrderNo,
              restaurantId: notification.restaurantId,
              restaurantName: notification.restaurantName || 'Restaurant',
              restaurantAddress: notification.restaurantAddress || '',
              restaurantLat: notification.restaurantLat || 0,
              restaurantLng: notification.restaurantLng || 0,
              deliveryAddress: notification.deliveryAddress || '',
              deliveryLat: notification.deliveryLat || 0,
              deliveryLng: notification.deliveryLng || 0,
              customerName: '',
              customerPhone: '',
              status: 'READY',
              deliveryFee: notification.deliveryFee || 0,
              tipAmount: notification.tipAmount || 0,
              total: notification.total || notification.deliveryFee || 0,
              itemCount: notification.itemCount || 0,
              createdAt: notification.createdAt || new Date().toISOString(),
              pickupDistance: notification.restaurantDistance,
              estimatedDistance: notification.deliveryDistance,
            };
            console.log('[CourierContext] Created newOrder:', JSON.stringify(newOrder, null, 2));
            return [newOrder, ...prev];
          } catch (innerError) {
            console.error('[CourierContext] Error in setAvailableOrders callback:', innerError);
            return prev;
          }
        });
      } catch (error) {
        console.error('[CourierContext] Error handling new order notification:', error);
      }
    });
    wsUnsubscribeRefs.current.push(unsubNewOrders);

    // Subscribe to personal notifications
    const unsubNotifications = websocketService.subscribeToNotifications((notification) => {
      console.log('[CourierContext] Notification received:', notification);
      // Add to notifications list
      setNotifications((prev) => {
        const newNotification: Notification = {
          id: notification.id,
          type: notification.type as any,
          title: notification.title,
          message: notification.message,
          read: false,
          createdAt: notification.createdAt,
          data: notification.data as any,
        };
        return [newNotification, ...prev];
      });
      // Increment unread count
      setUnreadCount((prev) => prev + 1);
    });
    wsUnsubscribeRefs.current.push(unsubNotifications);
  }, []);

  // Subscribe to order status updates for active orders
  const subscribeToOrderStatusUpdates = useCallback((orderId: string | number) => {
    const unsubscribe = websocketService.subscribeToOrderStatus(orderId, (statusUpdate) => {
      console.log('[CourierContext] Order status update:', statusUpdate);
      // Update the order in the orders list
      setOrders((prev) =>
        prev.map((order) =>
          order.orderId === statusUpdate.orderId
            ? { ...order, status: statusUpdate.status as OrderStatus }
            : order
        )
      );
    });
    wsUnsubscribeRefs.current.push(unsubscribe);
    return unsubscribe;
  }, []);

  // Clear new order offer (after user views/dismisses it)
  const clearNewOrderOffer = useCallback(() => {
    setNewOrderOffer(null);
  }, []);

  // Clear local session data
  const clearLocalSession = useCallback(async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Stop location tracking
    await stopLocationTracking();

    // Disconnect WebSocket
    disconnectWebSocket();

    setUser(null);
    setCourierProfile(null);
    setAccessToken(null);
    setRefreshToken(null);
    setOrders([]);
    setOrderHistory([]);
    setHistoryPagination(DEFAULT_HISTORY_PAGINATION);
    setNotifications([]);
    setUnreadCount(0);
    setStats(DEFAULT_STATS);
    setIsOnline(false);
    setCurrentLocation(null);
    setNewOrderOffer(null);
    hasLoadedInitialData.current = false;

    await AsyncStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_CONFIG.USER_KEY);
    await AsyncStorage.removeItem('courier_profile');
  }, [stopLocationTracking]);

  // Logout function - revokes refresh token on server
  const logout = useCallback(async () => {
    try {
      // Call logout API to revoke refresh token
      if (refreshToken) {
        await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    }

    // Always clear local session
    await clearLocalSession();
  }, [refreshToken, clearLocalSession]);

  // Logout from all devices - revokes all refresh tokens
  const logoutAllDevices = useCallback(async () => {
    try {
      if (accessToken) {
        const response = await fetch(`${BASE_URL}${API_ENDPOINTS.USER.LOGOUT_ALL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to logout from all devices');
        }
      }
    } catch (error) {
      console.error('Logout all devices API call failed:', error);
      throw error;
    }

    // Clear local session after successful API call
    await clearLocalSession();
  }, [accessToken, clearLocalSession]);

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

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (accessToken && user) {
      connectWebSocket(accessToken);
      subscribeToWebSocketTopics();
    }

    return () => {
      // Cleanup on unmount or when auth changes
      if (!accessToken || !user) {
        disconnectWebSocket();
      }
    };
  }, [accessToken, user, connectWebSocket, subscribeToWebSocketTopics, disconnectWebSocket]);

  // Subscribe to order status updates for active orders
  useEffect(() => {
    if (isWebSocketConnected && orders.length > 0) {
      // Subscribe to status updates for all active orders
      orders.forEach((order) => {
        if (order.status !== 'DELIVERED' && order.status !== 'CANCELLED') {
          subscribeToOrderStatusUpdates(order.orderId);
        }
      });
    }
  }, [isWebSocketConnected, orders, subscribeToOrderStatusUpdates]);

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
      console.log('[CourierContext] acceptOrder response:', data);

      if (data.success && data.data) {
        // Remove from available orders
        setAvailableOrders(prev => prev.filter(o => o.orderId !== orderId));

        // Add accepted order to active orders
        // Ensure status is 'ACCEPTED' - this is critical for navigation to work correctly
        const acceptedOrder: Order = {
          ...data.data,
          status: 'ACCEPTED' as OrderStatus, // Force ACCEPTED status regardless of API response
        };
        console.log('[CourierContext] Adding accepted order with status:', acceptedOrder.status);
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
    console.log('[CourierContext] updateOrderStatus called:', { orderId, status });

    // Optimistically update local state
    setOrders(prev => {
      const updated = prev.map(o => o.orderId === orderId ? { ...o, status } : o);
      console.log('[CourierContext] Orders updated locally, new statuses:', updated.map(o => ({ id: o.orderId, status: o.status })));
      return updated;
    });

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
          // Start transit to customer - PUT
          endpoint = API_ENDPOINTS.ORDERS.TRANSIT(orderId);
          method = 'PUT';
          break;
        case 'DELIVERED':
          // Complete delivery - POST
          endpoint = API_ENDPOINTS.ORDERS.COMPLETE(orderId);
          method = 'POST';
          break;
      }

      console.log('[CourierContext] Calling API:', { endpoint, method });

      if (endpoint) {
        const response = await authenticatedFetch(endpoint, { method });
        const result = await response.json();
        console.log('[CourierContext] API response:', { status: response.status, result });
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

      console.log('[CourierContext] updateOrderStatus completed successfully');
    } catch (error) {
      console.error('[CourierContext] Failed to update order status on server:', error);
      // Revert optimistic update on error
      await fetchOrders();
    }
  };

  // Complete order with optional photo and notes
  const completeOrder = useCallback(async (
    orderId: number | string,
    data?: { deliveryPhoto?: string; deliveryNotes?: string }
  ): Promise<{ orderId: number; status: string; earnings: number; message: string } | null> => {
    console.log('[CourierContext] completeOrder called with orderId:', orderId);
    console.log('[CourierContext] Endpoint:', API_ENDPOINTS.ORDERS.COMPLETE(orderId));

    // Optimistically update local state
    setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: 'DELIVERED' as OrderStatus } : o));

    try {
      console.log('[CourierContext] Making API call to complete order...');
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.COMPLETE(orderId), {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
      console.log('[CourierContext] API response status:', response.status);

      const result = await response.json();
      console.log('[CourierContext] API response body:', JSON.stringify(result));

      if (result.success && result.data) {
        console.log('[CourierContext] Order completed successfully, refreshing stats...');
        // Refresh stats after successful completion
        await fetchStats();

        // Check if there are more active orders
        const remainingActive = orders.filter(o =>
          o.orderId !== orderId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        );
        if (remainingActive.length === 0) {
          setCourierProfile(prev => prev ? { ...prev, status: 'AVAILABLE' } : null);
        }

        return result.data;
      } else {
        console.error('[CourierContext] API returned error:', result.message);
        throw new Error(result.message || 'Failed to complete order');
      }
    } catch (error) {
      console.error('[CourierContext] Failed to complete order:', error);
      // Revert optimistic update on error
      await fetchOrders();
      throw error;
    }
  }, [authenticatedFetch, fetchStats, fetchOrders, orders]);

  // Report an issue with an order
  const reportOrderIssue = useCallback(async (
    orderId: number | string,
    issueType: IssueType,
    description: string,
    photos?: string[]
  ): Promise<{ message: string } | null> => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.ISSUE(orderId), {
        method: 'POST',
        body: JSON.stringify({
          issueType,
          description,
          photos,
        }),
      });
      const result = await response.json();

      if (result.success) {
        // Refresh orders to get updated status
        await fetchOrders();
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to report issue');
      }
    } catch (error) {
      console.error('Failed to report issue:', error);
      throw error;
    }
  }, [authenticatedFetch, fetchOrders]);

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
    logoutAllDevices,
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
    completeOrder,
    reportOrderIssue,

    // Order history
    orderHistory,
    isLoadingHistory,
    historyPagination,
    fetchOrderHistory,
    loadMoreHistory,
    fetchOrderDetails,

    // Available orders (nearby orders to accept)
    availableOrders,
    isLoadingAvailableOrders,
    fetchAvailableOrders,
    acceptOrder,

    // Stats (legacy)
    stats,

    // Earnings
    earnings,
    earningsPeriod,
    isLoadingEarnings,
    fetchEarnings,

    // Notifications
    notifications,
    unreadCount,
    isLoadingNotifications,
    fetchNotifications,
    fetchUnreadCount,
    markNotificationAsRead,

    // WebSocket / Real-time updates
    isWebSocketConnected,
    newOrderOffer,
    clearNewOrderOffer,
    connectWebSocket,
    disconnectWebSocket,

    // Data refresh
    refreshData,
    refreshAccessToken,
  };
});

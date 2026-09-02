import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG, ORDER_CONFIG, LOCATION_CONFIG, IssueType, WEBSOCKET_CONFIG } from '@/constants/config';
import createContextHook from '@nkzw/create-context-hook';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
// Importing this module registers the background location task at startup
// (TaskManager.defineTask must run at module scope, before any OS delivery)
import { startBackgroundLocationUpdates, stopBackgroundLocationUpdates } from '@/lib/backgroundLocation';
import websocketService, { NewOrderNotification, OrderTakenNotification, AvailableOrdersChannelMessage, OrderChannelMessage, OrderDto, OrderStatusUpdate, WebSocketNotification, LocationConfirmation } from '@/services/websocket';
import { registerDeviceToken, unregisterDeviceToken } from '@/services/pushNotification';
import tokenManager from '@/services/tokenManager';
import logger from '@/lib/logger';
import { distanceMeters } from '@/lib/formatting';

export type OrderStatus = 'PENDING' | 'COURIER_ASSIGNED' | 'READY' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
// OFFLINE / AVAILABLE / ON_BREAK are courier-selectable. BUSY is set by the
// backend at the concurrent-order limit, PENDING_APPROVAL until an admin
// verifies the profile, and SUSPENDED by an admin — the last three are
// read-only states the app renders but never requests.
export type CourierStatus =
  | 'OFFLINE'
  | 'AVAILABLE'
  | 'BUSY'
  | 'ON_BREAK'
  | 'PENDING_APPROVAL'
  | 'SUSPENDED';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

// Re-export IssueType from config for convenience
export type { IssueType } from '@/constants/config';

// Re-export WebSocket types for convenience
export type { NewOrderNotification, OrderTakenNotification, AvailableOrdersChannelMessage, OrderChannelMessage, OrderDto, OrderStatusUpdate, WebSocketNotification, LocationConfirmation } from '@/services/websocket';

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
  // Period-based earnings
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
  // Payment type breakdown
  cashEarnings: number;
  cardEarnings: number;
  withdrawableBalance: number;
  // Period-based deliveries
  todayDeliveries: number;
  weekDeliveries: number;
  monthDeliveries: number;
  totalDeliveries: number;
  // Stats
  averagePerDelivery: number;
  pendingPayout: number;
  // Legacy fields (for backwards compatibility)
  deliveryFees?: number;
  tips?: number;
  avgPerDelivery?: number;
  onlineHours?: number;
  breakdown?: EarningsBreakdownItem[];
}

const DEFAULT_EARNINGS: EarningsSummary = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  totalEarnings: 0,
  cashEarnings: 0,
  cardEarnings: 0,
  withdrawableBalance: 0,
  todayDeliveries: 0,
  weekDeliveries: 0,
  monthDeliveries: 0,
  totalDeliveries: 0,
  averagePerDelivery: 0,
  pendingPayout: 0,
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
  | 'RATING_RECEIVED'
  | 'NEW_DELIVERY_AVAILABLE'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_CANCELLED';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  category?: string;
  icon?: string;
  orderId?: number;
  actionUrl?: string;
  timeAgo?: string;
  data?: {
    orderId?: number;
    orderNumber?: string;
    restaurantName?: string;
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
  // Non-null when the last active-orders sync failed and the list may be stale
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [stats, setStats] = useState<DriverStats>(DEFAULT_STATS);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
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
  const [orderTakenEvent, setOrderTakenEvent] = useState<OrderTakenNotification | null>(null);
  const wsUnsubscribeRefs = useRef<(() => void)[]>([]);
  // Per-order topic subscriptions (topics 3 & 4), keyed by orderId, so we
  // only subscribe once per active order and can unsubscribe when it leaves
  // the active set
  const orderSubscriptionsRef = useRef<Map<number, () => void>>(new Map());

  // Track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Last fix actually PUT to the backend — drives the send gate in the
  // location watcher (see LOCATION_CONFIG.MIN_SEND_*).
  const lastSentFixRef = useRef<{ latitude: number; longitude: number; at: number } | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  // Whether the location watcher was last started with the active-order
  // (fast) interval — lets us restart it when the active set flips
  const watcherHasActiveOrdersRef = useRef<boolean | null>(null);
  const isOnlineRef = useRef(false);
  const courierProfileRef = useRef<CourierProfile | null>(null);
  // The status the courier *wants* (set by user actions). The backend flips
  // couriers to OFFLINE when the WebSocket drops, so after every (re)connect
  // we re-assert this intent — otherwise the courier silently stops receiving
  // targeted order pushes while the UI still says "online". Null (first
  // connect after login, or after logout) means nothing to re-assert.
  const intendedStatusRef = useRef<CourierStatus | null>(null);
  const reassertStatusRef = useRef<(() => void) | null>(null);
  // Re-sync order state after a WebSocket (re)connect: events that fired
  // during the outage (cancellations, ORDER_TAKEN) are never replayed by the
  // broker, so pull fresh lists instead. Ref-based for the same stale-closure
  // reason as reassertStatusRef.
  const resyncAfterReconnectRef = useRef<(() => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    courierProfileRef.current = courierProfile;
  }, [courierProfile]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  // Always points at the latest logout closure — the tokenManager
  // subscription below has no deps, so it must not capture a stale logout.
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  // Refresh access token — delegates to the SINGLE single-flight refresh
  // authority (services/tokenManager), shared with the ApiClient 401-retry
  // path and the background location task. A DEFINITIVE rejection makes
  // tokenManager purge storage and emit 'session-dead' (routed to logout by
  // the subscription below); transport failures throw and keep the session.
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    return tokenManager.refresh();
  }, []);

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
        setLastSyncError(null);
      } else {
        setLastSyncError(data.message || 'Failed to sync orders');
      }
    } catch (error: any) {
      logger.error('Failed to fetch orders:', error);
      // Keep existing orders on error, but surface staleness so screens can
      // warn the courier that the list may be out of date
      setLastSyncError(error?.message || 'Failed to sync orders');
    }
  }, [authenticatedFetch]);

  // Fetch earnings from API with period support
  // Backend-verified: the earnings endpoint takes NO period/date params —
  // it always returns its own computed window. The optional args are kept
  // for signature compatibility but intentionally not sent.
  const fetchEarnings = useCallback(async (
    _period?: EarningsPeriod,
    _startDate?: string,
    _endDate?: string
  ) => {
    setIsLoadingEarnings(true);
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.EARNINGS);
      const data = await response.json();

      if (data.success && data.data) {
        // Map backend response to EarningsSummary
        setEarnings({
          ...DEFAULT_EARNINGS,
          ...data.data,
          // Ensure breakdown is always an array
          breakdown: data.data.breakdown || [],
        });
        // Legacy stats mapped directly from the backend's computed fields
        // (the response always carries today/week/month — no period switch)
        setStats(prev => ({
          ...prev,
          todayEarnings: data.data.todayEarnings ?? prev.todayEarnings,
          weekEarnings: data.data.weekEarnings ?? prev.weekEarnings,
          monthEarnings: data.data.monthEarnings ?? prev.monthEarnings,
          completedOrders: data.data.totalDeliveries ?? prev.completedOrders,
        }));
      }
    } catch (error) {
      logger.error('Failed to fetch earnings:', error);
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
      logger.error('Failed to fetch order history:', error);
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
      logger.error('Failed to fetch order details:', error);
      return null;
    }
  }, [authenticatedFetch]);

  // Fetch notifications
  const fetchNotifications = useCallback(async (page: number = 0, pageSize: number = 20) => {
    setIsLoadingNotifications(true);
    try {
      const params = new URLSearchParams({
        role: 'COURIER',
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const response = await authenticatedFetch(
        `${API_ENDPOINTS.NOTIFICATIONS.LIST}?${params}`
      );
      const data = await response.json();

      // Response: { notifications: [...], page, pageSize, totalElements, totalPages }
      const notificationsList: any[] = data.notifications ?? [];

      const transformedNotifications: Notification[] = notificationsList.map((n: any) => ({
        id: n.id,
        type: n.notificationType || n.type || 'ORDER_ASSIGNED',
        title: n.title,
        message: n.message,
        read: n.read ?? false,
        createdAt: n.createdAt,
        priority: n.priority,
        category: n.category,
        icon: n.icon,
        orderId: n.orderId || n.relatedEntityId,
        actionUrl: n.actionUrl,
        timeAgo: n.timeAgo,
        data: n.metadata ?? n.data,
      }));

      setNotifications(transformedNotifications);

      // Count unread from the list, or fetch separately
      const unread = transformedNotifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      logger.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [authenticatedFetch]);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await authenticatedFetch(
        `${API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT}?role=COURIER`
      );
      const data = await response.json();
      // Response: { unreadCount: 5 }
      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      logger.error('Failed to fetch unread count:', error);
    }
  }, [authenticatedFetch]);

  // Fetch courier profile and sync online status from backend
  const fetchCourierProfile = useCallback(async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.ME);
      const data = await response.json();

      if (data.success && data.data) {
        const profile = data.data as CourierProfile;
        setCourierProfile(profile);
        await AsyncStorage.setItem('courier_profile', JSON.stringify(profile));

        // Sync isOnline state from backend status
        const backendIsOnline = profile.status === 'AVAILABLE' || profile.status === 'BUSY';
        logger.log('[CourierContext] Syncing status from backend:', profile.status, '-> isOnline:', backendIsOnline);
        setIsOnline(backendIsOnline);

        return profile;
      }
    } catch (error) {
      logger.error('Failed to fetch courier profile:', error);
    }
    return null;
  }, [authenticatedFetch]);

  // Mark single notification as read
  // PATCH /notifications/{id}/read — returns the updated notification object
  const markNotificationAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
    }
  }, [authenticatedFetch]);

  // Mark all notifications as read
  // PATCH /notifications/read-all?userId={userId}&role=COURIER
  const markAllNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    try {
      // Backend-verified: userId is a MANDATORY query param (400 without it)
      const userId = user?.id || courierProfile?.userId;
      if (!userId) {
        logger.error('[CourierContext] Cannot mark all read: no userId in session');
        return;
      }
      const params = new URLSearchParams({ role: 'COURIER', userId: String(userId) });

      const response = await authenticatedFetch(
        `${API_ENDPOINTS.NOTIFICATIONS.READ_ALL}?${params}`,
        { method: 'PATCH' }
      );

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
    }
  }, [authenticatedFetch, unreadCount, user, courierProfile]);

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
      logger.error('Failed to fetch available orders:', error);
    } finally {
      setIsLoadingAvailableOrders(false);
    }
  }, [authenticatedFetch]);

  // Refresh all data including courier status from backend
  const refreshData = useCallback(async () => {
    if (!user) return;

    await Promise.all([
      fetchOrders(),
      fetchStats(),
      fetchUnreadCount(),
      fetchCourierProfile(), // Sync courier status from backend
    ]);
  }, [user, fetchOrders, fetchStats, fetchUnreadCount, fetchCourierProfile]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      try {
        if (typeof locationSubscriptionRef.current.remove === 'function') {
          locationSubscriptionRef.current.remove();
        }
      } catch (e) {
        // Ignore errors on web when cleaning up location subscription
        logger.log('[CourierContext] Location cleanup error (expected on web):', e);
      }
      locationSubscriptionRef.current = null;
    }
    watcherHasActiveOrdersRef.current = null;
    // Also stop OS-level background updates (no-op on web / when not running)
    try {
      await stopBackgroundLocationUpdates();
    } catch (e) {
      logger.warn('[CourierContext] Failed to stop background location updates:', e);
    }
    setIsLocationTracking(false);
  }, []);

  // Token provider for the WebSocket layer. Called by stompjs before EVERY
  // (re)connect attempt, so reconnects never present a stale JWT. Delegates
  // to tokenManager: refresh-if-expiring, single-flight, and on transport
  // failures it falls back to the current token (the reconnect loop retries
  // with a fresh one later).
  const getWebSocketToken = useCallback(async (): Promise<string | null> => {
    return tokenManager.getValidAccessToken();
  }, []);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    // Set up event handlers
    websocketService.onConnected(() => {
      logger.log('[CourierContext] WebSocket connected');
      setIsWebSocketConnected(true);

      // The backend flips couriers to OFFLINE when the socket drops. Re-assert
      // the courier's intended status on every (re)connect — on the first
      // connect after login intent is null, so this is a no-op then.
      reassertStatusRef.current?.();

      // Re-sync order state after every (re)connect: cancellations and
      // ORDER_TAKEN events that fired during the outage are never replayed
      // by the broker, so without this pull they would be missed forever.
      resyncAfterReconnectRef.current?.();
    });

    // Fires on both graceful disconnects and abrupt connection losses
    // (network drop, heartbeat timeout, server restart) — the service routes
    // onWebSocketClose here, since stompjs onDisconnect alone only covers
    // graceful deactivation.
    websocketService.onDisconnected(() => {
      logger.log('[CourierContext] WebSocket disconnected');
      setIsWebSocketConnected(false);

      // Reflect server truth: backend auto-flips AVAILABLE/ON_BREAK to OFFLINE
      // on disconnect. Intent is preserved in intendedStatusRef for re-assert.
      const status = courierProfileRef.current?.status;
      if (status === 'AVAILABLE' || status === 'ON_BREAK') {
        logger.log('[CourierContext] Reflecting server auto-offline after disconnect (was', status, ')');
        setCourierProfile(prev => prev ? { ...prev, status: 'OFFLINE' } : null);
        setIsOnline(false);
      }
    });

    websocketService.onError((error) => {
      logger.error('[CourierContext] WebSocket error:', error);
      setIsWebSocketConnected(false);
    });

    // Connect to WebSocket with a token provider so every (re)connect
    // attempt fetches a fresh (refreshed-if-needed) access token
    websocketService.connect(getWebSocketToken);
  }, [getWebSocketToken]);

  const disconnectWebSocket = useCallback(() => {
    // Unsubscribe from all topics
    wsUnsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    wsUnsubscribeRefs.current = [];

    // Unsubscribe per-order topic subscriptions (auth teardown)
    orderSubscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    orderSubscriptionsRef.current.clear();

    // Disconnect
    websocketService.disconnect();
    setIsWebSocketConnected(false);
    setNewOrderOffer(null);
  }, []);

  // Helper: add a new-order notification to state
  const addNewOrderToState = useCallback((notification: NewOrderNotification) => {
    setNewOrderOffer(notification);
    setAvailableOrders((prev) => {
      try {
        if (prev.some((o) => o.orderId === notification.orderId)) {
          return prev;
        }
        const newOrder: AvailableOrder = {
          orderId: notification.orderId,
          externalOrderNo: notification.externalOrderNo ?? '',
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
          status: 'PENDING',
          deliveryFee: notification.deliveryFee || 0,
          tipAmount: notification.tipAmount || 0,
          total: notification.total || notification.deliveryFee || 0,
          itemCount: notification.itemCount || 0,
          createdAt: notification.createdAt || new Date().toISOString(),
          pickupDistance: notification.restaurantDistance,
          estimatedDistance: notification.deliveryDistance,
        };
        return [newOrder, ...prev];
      } catch (innerError) {
        logger.error('[CourierContext] Error in setAvailableOrders callback:', innerError);
        return prev;
      }
    });
  }, []);

  // Helper: handle ORDER_TAKEN — remove from available list and dismiss offer
  const handleOrderTaken = useCallback((takenNotification: OrderTakenNotification) => {
    logger.log('[CourierContext] ORDER_TAKEN received:', takenNotification.orderId);

    setOrderTakenEvent(takenNotification);

    setAvailableOrders((prev) => {
      const filtered = prev.filter((o) => o.orderId !== takenNotification.orderId);
      if (filtered.length !== prev.length) {
        logger.log('[CourierContext] Removed order', takenNotification.orderId, 'from available orders');
      }
      return filtered;
    });

    setNewOrderOffer((prev) => {
      if (prev && prev.orderId === takenNotification.orderId) {
        return null;
      }
      return prev;
    });
  }, []);

  // Handler for incoming notification messages (shared by courier/user/broadcast topics 5, 6, 7)
  const handleNotificationMessage = useCallback((notification: WebSocketNotification) => {
    logger.log('[CourierContext] Notification received:', notification.id, notification.notificationType || notification.type);
    setNotifications((prev) => {
      const newNotification: Notification = {
        id: notification.id,
        type: (notification.notificationType || notification.type || 'NEW_ORDER_NEARBY') as any,
        title: notification.title,
        message: notification.message,
        read: notification.isRead ?? false,
        createdAt: notification.createdAt,
        priority: notification.priority as any,
        category: notification.category,
        icon: notification.icon,
        orderId: notification.orderId,
        actionUrl: notification.actionUrl,
        timeAgo: notification.timeAgo,
        data: notification.metadata as any ?? notification.data as any,
      };
      return [newNotification, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Available orders are a POLL, not a stream: there is no courier-wide
  // broadcast topic the backend will let us subscribe to, so new work reaches
  // the app through FCM push plus this refresh.
  //
  // Deliberately bounded: it runs ONLY while the app is foregrounded and the
  // courier is online. This burns their battery and their mobile data, and a
  // courier whose phone dies mid-shift cannot deliver.
  const pollAvailableOrdersRef = useRef<(() => void) | null>(null);
  pollAvailableOrdersRef.current = () => {
    fetchAvailableOrders(currentLocation?.latitude, currentLocation?.longitude);
  };

  useEffect(() => {
    if (!isOnline || !accessToken) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    const start = () => {
      if (refreshIntervalRef.current) return;
      refreshIntervalRef.current = setInterval(() => {
        pollAvailableOrdersRef.current?.();
      }, ORDER_CONFIG.AVAILABLE_ORDERS_POLL_MS);
    };
    const stop = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        // Refresh immediately on focus, then resume the interval
        pollAvailableOrdersRef.current?.();
        start();
      } else {
        stop();
      }
    };

    if (AppState.currentState === 'active') {
      start();
    }
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      stop();
    };
  }, [isOnline, accessToken]);

  // Subscribe to WebSocket topics.
  //
  // The backend authorizes every SUBSCRIBE frame and answers anything outside
  // its allow-list with a STOMP ERROR, which closes the whole connection. Only
  // these destinations are permitted for a courier:
  //   /topic/orders/{orderId}            (orders they are a party to)
  //   /topic/orders/{orderId}/taken      (any authenticated user)
  //   /topic/users/{userId}/notifications
  //   /topic/couriers/{courierId}/location   keyed by COURIER PROFILE id
  //
  // The broadcast available-orders, role-notification and platform-broadcast
  // topics this app used to take are NOT allowed; new work now arrives via FCM
  // push plus the foreground poll of GET /couriers/me/available-orders.
  const subscribeToWebSocketTopics = useCallback(() => {
    // Clear existing subscriptions
    wsUnsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    wsUnsubscribeRefs.current = [];

    // Personal user notifications — keyed by USER id
    const userId = user?.id || courierProfile?.userId;
    if (userId) {
      wsUnsubscribeRefs.current.push(
        websocketService.subscribeToUserNotifications(userId, handleNotificationMessage)
      );
    }

    // Location update confirmations — keyed by COURIER PROFILE id, which is a
    // different number from userId; confusing the two is silently rejected.
    const courierId = courierProfile?.id;
    if (courierId) {
      wsUnsubscribeRefs.current.push(
        websocketService.subscribeToLocationConfirmation(courierId, () => {
          logger.log('[CourierContext] Location update confirmed by server');
        })
      );
    }
  }, [user, courierProfile, handleNotificationMessage]);

  // Subscribe to order-specific topics (status updates + taken) for active orders.
  // Topics 3 and 4 are subscribed/unsubscribed dynamically as orders are accepted and completed.
  const subscribeToOrderStatusUpdates = useCallback((orderId: string | number) => {
    const unsubs: Array<() => void> = [];

    // 3. Full order updates (/topic/orders/{orderId}) — receives full OrderDto.
    // Cancellations/refunds arrive here too: the CANCELLED status propagates
    // into local state and every screen (detail, map-navigation, orders list)
    // reacts by pulling the courier off the job.
    unsubs.push(
      websocketService.subscribeToOrderUpdates(orderId, (orderDto) => {
        logger.log('[CourierContext] Order update:', orderDto.id, 'status:', orderDto.status);
        setOrders((prev) => {
          const updated = prev.map((order) =>
            order.orderId === orderDto.id
              ? {
                  ...order,
                  status: orderDto.status as OrderStatus,
                  customerName: orderDto.customerName ?? order.customerName,
                  customerPhone: orderDto.customerPhone ?? order.customerPhone,
                  deliveryFee: orderDto.deliveryFee ?? order.deliveryFee,
                  tipAmount: orderDto.tipAmount ?? order.tipAmount,
                  total: orderDto.total ?? order.total,
                  readyAt: orderDto.readyAt ?? order.readyAt,
                  pickedUpAt: orderDto.pickedUpAt ?? order.pickedUpAt,
                  deliveredAt: orderDto.deliveredAt ?? order.deliveredAt,
                }
              : order
          );

          // Order cancelled mid-delivery: if nothing else is active, flip the
          // courier back to AVAILABLE (mirrors the server-side state machine)
          if (orderDto.status === 'CANCELLED') {
            const remainingActive = updated.filter(
              (o) => o.orderId !== orderDto.id && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
            );
            if (remainingActive.length === 0) {
              setCourierProfile((p) => (p && p.status === 'BUSY' ? { ...p, status: 'AVAILABLE' } : p));
              if (intendedStatusRef.current === 'BUSY') {
                intendedStatusRef.current = 'AVAILABLE';
              }
            }
          }
          return updated;
        });
      })
    );

    // 4. Order taken by another courier (/topic/orders/{orderId}/taken)
    unsubs.push(
      websocketService.subscribeToOrderTaken(orderId, handleOrderTaken)
    );

    // Combined unsubscribe for both order-specific topics. Lifecycle is
    // owned by orderSubscriptionsRef (subscribe once per active order,
    // unsubscribe when it leaves the active set) — NOT wsUnsubscribeRefs,
    // which subscribeToWebSocketTopics clears wholesale on re-subscribe.
    return () => unsubs.forEach((fn) => fn());
  }, [handleOrderTaken]);

  // Clear new order offer (after user views/dismisses it)
  const clearNewOrderOffer = useCallback(() => {
    setNewOrderOffer(null);
  }, []);

  // Handle push notification for new delivery (FCM NEW_DELIVERY_AVAILABLE)
  const handleNewOrderPush = useCallback((data: {
    orderId?: string | number;
    orderNumber?: string;
    restaurantName?: string;
  }) => {
    if (!data.orderId) {
      logger.log('[CourierContext] Push notification missing orderId');
      return;
    }

    const orderId = typeof data.orderId === 'string' ? parseInt(data.orderId, 10) : data.orderId;

    logger.log('[CourierContext] Handling NEW_DELIVERY_AVAILABLE push:', orderId);

    // Create a minimal NewOrderNotification to trigger the modal
    const notification: NewOrderNotification = {
      type: 'NEW_ORDER',
      orderId,
      externalOrderNo: data.orderNumber,
      restaurantId: 0,
      restaurantName: data.restaurantName || 'Restaurant',
      itemCount: 0,
    };

    setNewOrderOffer(notification);
  }, []);

  // Clear order taken event (after user acknowledges it)
  const clearOrderTakenEvent = useCallback(() => {
    setOrderTakenEvent(null);
  }, []);

  // Remove an order from available orders (e.g., when it's taken by another courier)
  const removeAvailableOrder = useCallback((orderId: number) => {
    setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
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

    // Clear status intent — it belongs to the ending session. Without this,
    // the next login (possibly a different courier on the same device) would
    // re-assert the previous user's AVAILABLE/BUSY on first connect.
    intendedStatusRef.current = null;

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
    setLastSyncError(null);
    hasLoadedInitialData.current = false;

    // Purge tokens from memory AND storage via the single token authority
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    await tokenManager.clearTokens();

    await AsyncStorage.removeItem(TOKEN_CONFIG.USER_KEY);
    await AsyncStorage.removeItem('courier_profile');
  }, [stopLocationTracking]);

  // Logout function - revokes refresh token on server
  const logout = useCallback(async () => {
    // Unregister FCM device token before logout
    if (accessToken) {
      try {
        await unregisterDeviceToken(accessToken);
      } catch (error) {
        logger.warn('Failed to unregister FCM token:', error);
      }
    }

    try {
      // Call logout API to revoke refresh token. Read the token through the
      // ref AT FETCH TIME, not the closure: unregisterDeviceToken above may
      // have rotated the pair mid-logout (its token validation refreshes
      // near-expiry tokens), and revoking the spent closure value would
      // leave the live refresh token valid server-side.
      const liveRefreshToken = refreshTokenRef.current ?? refreshToken;
      if (liveRefreshToken) {
        await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: liveRefreshToken }),
        });
      }
    } catch (error) {
      logger.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    }

    // Always clear local session
    await clearLocalSession();
  }, [accessToken, refreshToken, clearLocalSession]);

  // Keep logoutRef pointing at the latest logout closure (used by the
  // dependency-free single-flight refresh)
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // Mirror tokenManager events into context state/refs. Rotations — from ANY
  // refresh path (401-retries, WS token provider, background location task) —
  // keep React state consistent; a definitive refresh rejection
  // ('session-dead') routes to the existing logout path.
  useEffect(() => {
    const unsubscribe = tokenManager.subscribe((event) => {
      if (event.type === 'rotated') {
        // Update refs synchronously so concurrent callers see fresh tokens
        accessTokenRef.current = event.accessToken;
        refreshTokenRef.current = event.refreshToken;
        setAccessToken(event.accessToken);
        setRefreshToken(event.refreshToken);
      } else if (event.type === 'session-dead') {
        logger.warn('[CourierContext] Refresh token rejected by server — logging out');
        logoutRef.current().catch((error) => {
          logger.error('[CourierContext] Logout after session death failed:', error);
        });
      }
      // 'cleared' needs no handling: it is only emitted from logout paths
      // that already reset context state themselves.
    });
    return unsubscribe;
  }, []);

  // Logout from all devices - revokes all refresh tokens
  const logoutAllDevices = useCallback(async () => {
    // Unregister FCM device token before logout
    if (accessToken) {
      try {
        await unregisterDeviceToken(accessToken);
      } catch (error) {
        logger.warn('Failed to unregister FCM token:', error);
      }
    }

    try {
      // Same stale-closure hazard as logout(): unregisterDeviceToken may
      // have rotated the tokens above — authorize with the live value.
      const liveAccessToken = accessTokenRef.current ?? accessToken;
      if (liveAccessToken) {
        const response = await fetch(`${BASE_URL}${API_ENDPOINTS.USER.LOGOUT_ALL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${liveAccessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to logout from all devices');
        }
      }
    } catch (error) {
      logger.error('Logout all devices API call failed:', error);
      throw error;
    }

    // Clear local session after successful API call
    await clearLocalSession();
  }, [accessToken, clearLocalSession]);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // READ-ONLY priming through the token authority: getTokens() loads
        // from storage on a cold cache but never writes. Writing the stored
        // values back (the previous setTokens approach) could re-persist an
        // already-spent refresh token over a rotation the background
        // location task performed during cold start — killing the session
        // on the next refresh.
        const { accessToken: storedToken, refreshToken: storedRefresh } = await tokenManager.getTokens();
        const storedUser = await AsyncStorage.getItem(TOKEN_CONFIG.USER_KEY);
        const storedProfile = await AsyncStorage.getItem('courier_profile');

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));

          if (storedProfile) {
            const profile = JSON.parse(storedProfile) as CourierProfile;
            setCourierProfile(profile);

            // Set initial isOnline from stored profile (will be refreshed from backend)
            const storedIsOnline = profile.status === 'AVAILABLE' || profile.status === 'BUSY';
            logger.log('[CourierContext] Initial status from storage:', profile.status, '-> isOnline:', storedIsOnline);
            setIsOnline(storedIsOnline);
          }

          // Register FCM device token on app start
          registerDeviceToken(storedToken).catch(err =>
            logger.warn('Failed to register FCM token on restore:', err)
          );
        }
      } catch (e) {
        logger.error('Failed to restore session', e);
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

  // Connect to WebSocket when authenticated. The service receives a token
  // PROVIDER, so token rotations don't require reconnecting — stompjs asks
  // for a fresh token before every (re)connect attempt.
  useEffect(() => {
    if (accessToken && user) {
      connectWebSocket();
      subscribeToWebSocketTopics();
    }

    return () => {
      // Cleanup on unmount or when auth changes
      if (!accessToken || !user) {
        disconnectWebSocket();
      }
    };
  }, [accessToken, user, connectWebSocket, subscribeToWebSocketTopics, disconnectWebSocket]);

  // Subscribe to order status updates for active orders.
  // Tracks per-order subscriptions in a ref: subscribe only to orders newly
  // entering the active set, unsubscribe those that leave it — handlers never
  // accumulate across `orders` state changes. Full teardown happens in
  // disconnectWebSocket (auth loss / logout / unmount).
  useEffect(() => {
    if (!isWebSocketConnected) {
      return;
    }

    const activeOrderIds = new Set(
      orders
        .filter((order) => order.status !== 'DELIVERED' && order.status !== 'CANCELLED')
        .map((order) => Number(order.orderId))
    );

    // Subscribe to orders that just became active
    activeOrderIds.forEach((orderId) => {
      if (!orderSubscriptionsRef.current.has(orderId)) {
        orderSubscriptionsRef.current.set(orderId, subscribeToOrderStatusUpdates(orderId));
      }
    });

    // Unsubscribe from orders that left the active set
    orderSubscriptionsRef.current.forEach((unsubscribe, orderId) => {
      if (!activeOrderIds.has(orderId)) {
        unsubscribe();
        orderSubscriptionsRef.current.delete(orderId);
      }
    });
  }, [isWebSocketConnected, orders, subscribeToOrderStatusUpdates]);

  // Safety net: unsubscribe all per-order topics when the provider unmounts
  useEffect(() => {
    const subscriptionsMap = orderSubscriptionsRef.current;
    return () => {
      subscriptionsMap.forEach((unsubscribe) => unsubscribe());
      subscriptionsMap.clear();
    };
  }, []);

  // Fetch active orders when going online
  // Available orders come via WebSocket and push notifications, no polling needed
  useEffect(() => {
    if (isOnline && user) {
      fetchOrders();
    }
  }, [isOnline, user]);

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
        // Do not log the raw body — it can contain tokens/PII
        logger.error('Failed to parse login response, status:', response.status);
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (data.success) {
        // Save tokens first
        const accessToken = data.data.accessToken;
        const refreshToken = data.data.refreshToken;

        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        accessTokenRef.current = accessToken;
        refreshTokenRef.current = refreshToken;
        await tokenManager.setTokens(accessToken, refreshToken);

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
          logger.error('Failed to fetch courier profile:', profileError);
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

        // Register FCM device token for push notifications
        registerDeviceToken(accessToken).catch(err =>
          logger.warn('Failed to register FCM token:', err)
        );
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      logger.error('Login error:', error);
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
      logger.error('Request OTP error:', error);
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
        accessTokenRef.current = data.data.accessToken;
        refreshTokenRef.current = data.data.refreshToken;
        await tokenManager.setTokens(data.data.accessToken, data.data.refreshToken);
        setUser(data.data.user);
        if (data.data.courier) {
          setCourierProfile(data.data.courier);
          await AsyncStorage.setItem('courier_profile', JSON.stringify(data.data.courier));
        }
        hasLoadedInitialData.current = false;

        await AsyncStorage.setItem(TOKEN_CONFIG.USER_KEY, JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      logger.error('Verify OTP error:', error);
      throw error;
    }
  };

  // Update courier status (OFFLINE/AVAILABLE/BUSY/ON_BREAK)
  const updateCourierStatus = useCallback(async (status: CourierStatus) => {
    // Record intent first so a reconnect re-asserts it even if this call races
    // with a connection drop; keep the previous value to revert on rejection
    const previousIntent = intendedStatusRef.current;
    intendedStatusRef.current = status;
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COURIER.UPDATE_STATUS, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update courier status');
      }
      // Intent may have moved while this request was in flight (e.g. the
      // courier accepted an order -> BUSY during a reconnect re-assert of
      // AVAILABLE). Never let a stale response overwrite the newer state.
      if (intendedStatusRef.current === status) {
        setCourierProfile(prev => prev ? { ...prev, status } : null);
        setIsOnline(status === 'AVAILABLE' || status === 'BUSY');
      }
    } catch (error) {
      logger.error('Failed to update courier status:', error);
      // Revert intent only if nothing newer replaced it meanwhile — a
      // server-rejected transition must not keep poisoning future re-asserts
      if (intendedStatusRef.current === status) {
        intendedStatusRef.current = previousIntent;
      }
      throw error;
    }
  }, [authenticatedFetch]);

  // Keep the reconnect re-assert handler pointing at the latest closure.
  // Called after every WebSocket reconnect: if the courier intended to be
  // online, push that status back to the server (backend flipped it to
  // OFFLINE when the socket dropped).
  useEffect(() => {
    reassertStatusRef.current = () => {
      const intended = intendedStatusRef.current;
      if (intended && intended !== 'OFFLINE') {
        logger.log('[CourierContext] Re-asserting courier status after reconnect:', intended);
        updateCourierStatus(intended).catch((error) => {
          logger.error('[CourierContext] Failed to re-assert status after reconnect:', error);
        });
      }
    };
  }, [updateCourierStatus]);

  // Keep the reconnect resync handler pointing at the latest closures.
  // Fired from the WebSocket onConnected path: order events missed during a
  // socket outage (a cancellation mid-delivery, an offer taken by another
  // courier) are not replayed by the broker, so pull both lists fresh.
  useEffect(() => {
    resyncAfterReconnectRef.current = () => {
      logger.log('[CourierContext] Resyncing orders after WebSocket (re)connect');
      fetchOrders().catch(() => {});
      fetchAvailableOrders().catch(() => {});
    };
  }, [fetchOrders, fetchAvailableOrders]);

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
      logger.error('Failed to update location:', error);
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
      try {
        if (typeof locationSubscriptionRef.current.remove === 'function') {
          locationSubscriptionRef.current.remove();
        }
      } catch (e) {
        // Ignore errors on web when cleaning up location subscription
        logger.log('[CourierContext] Location cleanup error (expected on web):', e);
      }
      locationSubscriptionRef.current = null;
    }

    // Determine update interval based on whether courier has active orders
    // (terminal statuses are DELIVERED and CANCELLED)
    const hasActiveOrders = orders.some(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
    watcherHasActiveOrdersRef.current = hasActiveOrders;
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

        // The OS delivers fixes far more often than the backend needs them.
        // Send at most one every MIN_SEND_INTERVAL_MS, and only when the
        // courier has actually moved — with a heartbeat so a stationary
        // courier's position does not go stale. This is their battery and
        // their mobile data; a phone that dies mid-shift cannot deliver.
        const now = Date.now();
        const last = lastSentFixRef.current;
        if (last) {
          const elapsed = now - last.at;
          if (elapsed < LOCATION_CONFIG.MIN_SEND_INTERVAL_MS) return;
          const moved = distanceMeters(last, { latitude, longitude });
          if (
            moved < LOCATION_CONFIG.MIN_SEND_DISTANCE_M &&
            elapsed < LOCATION_CONFIG.SEND_HEARTBEAT_MS
          ) {
            return;
          }
        }
        lastSentFixRef.current = { latitude, longitude, at: now };

        updateLocationOnServer(
          latitude,
          longitude,
          accuracy ?? undefined,
          heading ?? undefined,
          speed ?? undefined
        );
      }
    );

    // Background tracking (native only): keeps the position flowing while the
    // app is backgrounded — e.g. after handing the courier off to an external
    // navigation app mid-delivery. Background permission can only be requested
    // AFTER foreground permission is granted. Denied background permission
    // degrades gracefully to foreground-only tracking (no error thrown).
    if (Platform.OS !== 'web') {
      try {
        let { status: bgStatus, canAskAgain } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== 'granted' && canAskAgain) {
          ({ status: bgStatus } = await Location.requestBackgroundPermissionsAsync());
        }
        if (bgStatus === 'granted') {
          await startBackgroundLocationUpdates();
        } else {
          logger.warn('[CourierContext] Background location permission not granted — foreground-only tracking');
        }
      } catch (bgError) {
        logger.warn('[CourierContext] Failed to start background location updates:', bgError);
      }
    }

    setIsLocationTracking(true);
  }, [updateLocationOnServer, orders]);

  const toggleOnline = async () => {
    const newStatus: CourierStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';

    if (newStatus === 'AVAILABLE') {
      // Request location permission BEFORE flipping the server status: a
      // denied permission must never leave the courier AVAILABLE on the
      // server while the app cannot report their position.
      await startLocationTracking(); // throws if permission denied
      try {
        await updateCourierStatus('AVAILABLE');
      } catch (error) {
        // Server rejected the status change — don't keep tracking
        await stopLocationTracking();
        throw error;
      }
    } else {
      await updateCourierStatus('OFFLINE');
      await stopLocationTracking();
    }
  };

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'DELIVERED'), [orders]);

  // Restart the location watcher with the right cadence when the courier
  // gains their first active order (IDLE_INTERVAL -> ACTIVE_INTERVAL) or
  // loses the last one (back to IDLE_INTERVAL).
  useEffect(() => {
    if (!isLocationTracking) {
      return;
    }
    const hasActive = activeOrders.length > 0;
    if (watcherHasActiveOrdersRef.current !== null && watcherHasActiveOrdersRef.current !== hasActive) {
      startLocationTracking().catch((error) => {
        logger.error('[CourierContext] Failed to restart location watcher:', error);
      });
    }
  }, [activeOrders.length, isLocationTracking, startLocationTracking]);

  // Accept an available order
  const acceptOrder = useCallback(async (orderId: number | string) => {
    // Distinguishes a definitive server rejection (order taken/cancelled)
    // from a transport failure where the accept may have succeeded server-side
    let serverRejected = false;
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.ACCEPT(orderId), {
        method: 'POST',
      });

      const data = await response.json();
      // Don't dump the full payload — it carries customer name/phone/address
      logger.log('[CourierContext] acceptOrder response:', data.success, data.data?.orderId ?? orderId);

      if (data.success && data.data) {
        // Remove from available orders
        setAvailableOrders(prev => prev.filter(o => o.orderId !== orderId));

        // Add accepted order to active orders
        const acceptedOrder: Order = {
          ...data.data,
          status: (data.data.status || 'COURIER_ASSIGNED') as OrderStatus,
        };
        logger.log('[CourierContext] Adding accepted order with status:', acceptedOrder.status);
        setOrders(prev => [acceptedOrder, ...prev]);

        // Update courier status to BUSY since they have an active order.
        // Keep intent in sync so a reconnect doesn't re-assert AVAILABLE
        // mid-delivery.
        setCourierProfile(prev => prev ? { ...prev, status: 'BUSY' } : null);
        intendedStatusRef.current = 'BUSY';

        return acceptedOrder;
      } else {
        serverRejected = true;
        throw new Error(data.message || 'Failed to accept order');
      }
    } catch (error) {
      logger.error('Failed to accept order:', error);
      if (serverRejected) {
        // Definitive: taken by another courier or auto-cancelled. Drop the
        // stale offer and refresh the list.
        setAvailableOrders(prev => prev.filter(o => o.orderId !== Number(orderId)));
        setNewOrderOffer(prev => (prev && prev.orderId === Number(orderId) ? null : prev));
        fetchAvailableOrders().catch(() => {});
      } else {
        // Ambiguous transport failure (timeout/dropped response): the accept
        // may have landed server-side. Sync both lists so a silently-assigned
        // order surfaces instead of the courier looking free while assigned.
        fetchOrders().catch(() => {});
        fetchAvailableOrders().catch(() => {});
      }
      throw error;
    }
  }, [authenticatedFetch, fetchAvailableOrders, fetchOrders]);

  const updateOrderStatus = async (orderId: number | string, status: OrderStatus) => {
    const numericOrderId = Number(orderId);
    logger.log('[CourierContext] updateOrderStatus called:', { orderId, numericOrderId, status });

    // Optimistically update local state
    setOrders(prev => {
      const updated = prev.map(o => {
        const matches = Number(o.orderId) === numericOrderId;
        if (matches) {
          logger.log('[CourierContext] Found matching order, updating status from', o.status, 'to', status);
        }
        return matches ? { ...o, status } : o;
      });
      logger.log('[CourierContext] Orders updated locally, new statuses:', updated.map(o => ({ id: o.orderId, status: o.status })));
      return updated;
    });

    // Update on server
    try {
      let endpoint = '';
      let method = 'PUT';

      switch (status) {
        case 'PICKED_UP':
          endpoint = API_ENDPOINTS.ORDERS.PICKUP(orderId);
          method = 'PUT';
          break;
        case 'IN_TRANSIT':
          endpoint = API_ENDPOINTS.ORDERS.TRANSIT(orderId);
          method = 'PUT';
          break;
        case 'DELIVERED':
          endpoint = API_ENDPOINTS.ORDERS.COMPLETE(orderId);
          method = 'POST';
          break;
      }

      logger.log('[CourierContext] Calling API:', { endpoint, method });

      if (endpoint) {
        const response = await authenticatedFetch(endpoint, { method });
        const result = await response.json();
        logger.log('[CourierContext] API response:', { status: response.status, success: result.success });
        if (result.success === false) {
          throw new Error(result.message || 'Failed to update order status');
        }
      }

      // Refresh stats and set status back to AVAILABLE after delivery completed
      if (status === 'DELIVERED') {
        await fetchStats();
        // Check if there are more active orders
        const remainingActive = orders.filter(o =>
          o.orderId !== orderId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        );
        // Flip back to AVAILABLE only if the courier hadn't explicitly chosen
        // otherwise mid-delivery (e.g. toggled OFFLINE to stop after this job).
        // Null intent (restored session) keeps the old flip but records nothing.
        const intentAfterDelivery = intendedStatusRef.current;
        if (remainingActive.length === 0 && (intentAfterDelivery === 'BUSY' || intentAfterDelivery === null)) {
          setCourierProfile(prev => prev ? { ...prev, status: 'AVAILABLE' } : null);
          if (intentAfterDelivery === 'BUSY') {
            intendedStatusRef.current = 'AVAILABLE';
          }
        }
      }

      logger.log('[CourierContext] updateOrderStatus completed successfully');
    } catch (error) {
      logger.error('[CourierContext] Failed to update order status on server:', error);
      // Revert optimistic update on error. Also re-sync the courier profile:
      // a CANCELLED frame may have flipped us AVAILABLE based on the
      // optimistic DELIVERED state that just got reverted.
      await fetchOrders();
      fetchCourierProfile().catch(() => {});
      throw error;
    }
  };

  // Complete order with optional photo and notes
  const completeOrder = useCallback(async (
    orderId: number | string,
    data?: { deliveryPhoto?: string; deliveryNotes?: string }
  ): Promise<{ orderId: number; status: string; earnings: number; message: string } | null> => {
    const numericOrderId = Number(orderId);
    logger.log('[CourierContext] completeOrder called with orderId:', orderId, 'numericOrderId:', numericOrderId);
    logger.log('[CourierContext] Endpoint:', API_ENDPOINTS.ORDERS.COMPLETE(orderId));

    // Optimistically update local state
    setOrders(prev => prev.map(o => Number(o.orderId) === numericOrderId ? { ...o, status: 'DELIVERED' as OrderStatus } : o));

    try {
      logger.log('[CourierContext] Making API call to complete order...');
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.COMPLETE(orderId), {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
      logger.log('[CourierContext] API response status:', response.status);

      const result = await response.json();
      // Don't dump the full payload — it can carry customer PII
      logger.log('[CourierContext] completeOrder response:', result.success, result.data?.orderId ?? numericOrderId);

      if (result.success && result.data) {
        logger.log('[CourierContext] Order completed successfully, refreshing stats...');
        // Refresh stats after successful completion
        await fetchStats();

        // Check if there are more active orders
        const remainingActive = orders.filter(o =>
          o.orderId !== orderId && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        );
        // Flip back to AVAILABLE only if the courier hadn't explicitly chosen
        // otherwise mid-delivery (e.g. toggled OFFLINE to stop after this job).
        // Null intent (restored session) keeps the old flip but records nothing.
        const intentAfterDelivery = intendedStatusRef.current;
        if (remainingActive.length === 0 && (intentAfterDelivery === 'BUSY' || intentAfterDelivery === null)) {
          setCourierProfile(prev => prev ? { ...prev, status: 'AVAILABLE' } : null);
          if (intentAfterDelivery === 'BUSY') {
            intendedStatusRef.current = 'AVAILABLE';
          }
        }

        return result.data;
      } else {
        logger.error('[CourierContext] API returned error:', result.message);
        throw new Error(result.message || 'Failed to complete order');
      }
    } catch (error) {
      logger.error('[CourierContext] Failed to complete order:', error);
      // Revert optimistic update on error. Also re-sync the courier profile:
      // a CANCELLED frame may have flipped us AVAILABLE based on the
      // optimistic DELIVERED state that just got reverted.
      await fetchOrders();
      fetchCourierProfile().catch(() => {});
      throw error;
    }
  }, [authenticatedFetch, fetchStats, fetchOrders, fetchCourierProfile, orders]);

  // Report an issue with an order
  // No photo attachment: the app has no image picker (expo-image-picker was
  // removed) and the Play Data safety form declares that no photos are
  // collected. Keeping a `photos` field here would be a latent contradiction
  // of that declaration the moment someone wired a caller to it.
  const reportOrderIssue = useCallback(async (
    orderId: number | string,
    issueType: IssueType,
    description: string
  ): Promise<{ message: string } | null> => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ORDERS.ISSUE(orderId), {
        method: 'POST',
        body: JSON.stringify({
          issueType,
          description,
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
      logger.error('Failed to report issue:', error);
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
    authenticatedFetch,

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
    // Staleness: non-null / true when the last active-orders sync failed and
    // the current list may be out of date
    lastSyncError,
    isStale: lastSyncError !== null,

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
    markAllNotificationsAsRead,

    // WebSocket / Real-time updates
    isWebSocketConnected,
    newOrderOffer,
    clearNewOrderOffer,
    handleNewOrderPush,
    orderTakenEvent,
    clearOrderTakenEvent,
    removeAvailableOrder,
    connectWebSocket,
    disconnectWebSocket,

    // Data refresh
    refreshData,
    refreshAccessToken,
  };
});

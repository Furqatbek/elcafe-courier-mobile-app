/**
 * API Service Layer
 * Handles all HTTP requests with proper error handling, token management, and retry logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  BASE_URL,
  API_ENDPOINTS,
  REQUEST_CONFIG,
  CourierStatusType,
  VehicleType,
  IssueType,
  EarningsPeriodType,
} from '@/constants/config';
import logger from '@/lib/logger';
// NOTE: tokenManager imports tokenStorage back from this module. The cycle is
// safe because neither module touches the other at module-eval time — all
// cross-references happen inside functions.
import tokenManager from '@/services/tokenManager';

// ============================================================================
// Token Storage
// ============================================================================

/**
 * Secure storage for auth tokens.
 *
 * Native (iOS/Android): expo-secure-store (Keychain / EncryptedSharedPreferences).
 * Web: AsyncStorage fallback — SecureStore is unavailable there.
 *
 * Reads transparently migrate tokens that older app versions persisted in
 * AsyncStorage into SecureStore (and delete the plaintext copy).
 */
const isSecureStoreAvailable = Platform.OS !== 'web';

// AFTER_FIRST_UNLOCK: the background location task must be able to read the
// access token while the phone is locked in the courier's pocket. The iOS
// default (WHEN_UNLOCKED) makes every Keychain read fail on a locked device,
// silently killing background location updates.
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isSecureStoreAvailable) {
      return AsyncStorage.getItem(key);
    }
    let value = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    if (value == null) {
      // One-time migration from legacy AsyncStorage persistence
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await SecureStore.setItemAsync(key, legacy, SECURE_STORE_OPTIONS);
        await AsyncStorage.removeItem(key);
        value = legacy;
      }
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isSecureStoreAvailable) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    if (!isSecureStoreAvailable) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    // Also drop any legacy plaintext copy that was never migrated
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: number;
  data: null;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  roles: string[];
}

export interface LoginRequest {
  emailOrPhone: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface OtpRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}

export interface CourierProfile {
  id: number;
  userId: number;
  userName: string;
  email: string;
  phone: string;
  status: CourierStatusType;
  vehicleType: VehicleType;
  vehicleNumber: string;
  licenseNumber?: string;
  currentLat?: number;
  currentLng?: number;
  verified: boolean;
  verifiedAt?: string;
  currentOrderCount: number;
  maxConcurrentOrders: number;
  totalDeliveries: number;
  averageRating: number | null;
  todayEarnings: number;
  weeklyEarnings: number;
  preferredRadiusKm?: number;
}

export interface CourierRegisterRequest {
  vehicleType: VehicleType;
  // Optional: a courier on foot, on a bicycle or on an e-bike has neither a
  // number plate nor a driving licence. See VEHICLE_TYPES_REQUIRING_* in
  // constants/config.ts for which types send them.
  vehicleNumber?: string;
  licenseNumber?: string;
  preferredRadiusKm?: number;
}

/**
 * Body of PUT /couriers/me.
 *
 * These five fields are the whole accepted set. firstName/lastName/email/phone
 * used to be declared here and were silently dropped by the backend — personal
 * fields belong to PUT /users/me. vehicleBrand/vehicleModel were likewise never
 * accepted, so the vehicle form required two values that went nowhere.
 */
export interface CourierUpdateRequest {
  vehicleType?: VehicleType;
  vehicleNumber?: string;
  licenseNumber?: string;
  preferredRadiusKm?: number;
  maxConcurrentOrders?: number;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export interface DeliveryAddress {
  fullAddress: string;
  latitude: number;
  longitude: number;
  distance?: number;
  instructions?: string;
}

export interface Customer {
  name: string;
  phone: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface AvailableOrder {
  orderId: number;
  // Flat structure (new backend)
  externalOrderNo?: string;
  restaurantId?: number;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantLat?: number;
  restaurantLng?: number;
  restaurantDistance?: number;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistance?: number;
  customerName?: string;
  deliveryFee?: number;
  tipAmount?: number;
  total?: number;
  itemCount: number;
  createdAt: string;
  expiresAt?: string;
  estimatedDistance?: number;
  // Nested structure (legacy support)
  orderNumber?: string;
  restaurant?: Restaurant;
  estimatedEarnings?: number;
}

export interface ActiveOrder {
  orderId: number;
  orderNumber: string;
  status: string;
  restaurant: Restaurant;
  customer: Customer;
  deliveryAddress: DeliveryAddress;
  items: OrderItem[];
  paymentMethod: string;
  isPaid: boolean;
  totalAmount: number;
  deliveryFee?: number;
  tip?: number;
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
}

export interface OrderIssueRequest {
  issueType: IssueType;
  description: string;
  photos?: string[];
}

export interface DeliveryCompleteRequest {
  deliveryPhoto?: string;
  deliveryNotes?: string;
}

export interface EarningsSummary {
  period: EarningsPeriodType;
  totalEarnings: number;
  deliveryFees: number;
  tips: number;
  totalDeliveries: number;
  avgPerDelivery: number;
  onlineHours: number;
  breakdown: {
    date: string;
    earnings: number;
    deliveries: number;
  }[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

// ============================================================================
// Error Classes
// ============================================================================

export class ApiRequestError extends Error {
  code: number;
  originalError?: any;

  constructor(message: string, code: number = 500, originalError?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.originalError = originalError;
  }
}

export class NetworkError extends ApiRequestError {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message, 0);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiRequestError {
  constructor(message: string = 'Authentication failed. Please login again.') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends ApiRequestError {
  constructor(message: string = 'Validation error.') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// API Client
// ============================================================================

class ApiClient {
  // Token state and refresh logic live in services/tokenManager — the single
  // refresh authority shared by every auth path in the app. These two methods
  // are kept as thin delegates for backward compatibility.
  setTokens(accessToken: string, refreshToken: string) {
    tokenManager.setTokens(accessToken, refreshToken).catch((error) => {
      logger.error('Failed to persist tokens:', error);
    });
  }

  clearTokens() {
    tokenManager.clearTokens().catch((error) => {
      logger.error('Failed to clear tokens:', error);
    });
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (requiresAuth) {
      const accessToken = await tokenManager.getAccessToken();
      if (accessToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Handle 401 - try refresh (single-flight, shared with every other
      // refresh path via tokenManager). A definitive rejection purges the
      // stored tokens and emits 'session-dead' inside tokenManager.
      if (response.status === 401 && requiresAuth) {
        const newToken = await tokenManager.refresh();
        if (newToken) {
          (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return this.handleResponse<T>(retryResponse);
        }
        throw new AuthenticationError();
      }

      return this.handleResponse<T>(response);
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        throw new NetworkError('Request timed out');
      }

      if (error instanceof ApiRequestError) {
        throw error;
      }

      throw new NetworkError(error.message || 'Network error');
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: ApiResponse<T>;

    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiRequestError(`Invalid response: ${text.substring(0, 100)}`, response.status);
    }

    if (!response.ok || !data.success) {
      const message = data.message || `Request failed with status ${response.status}`;
      throw new ApiRequestError(message, response.status);
    }

    return data.data;
  }

  // Convenience methods
  async get<T>(endpoint: string, requiresAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requiresAuth);
  }

  async post<T>(endpoint: string, body?: any, requiresAuth = true): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'POST', body: body ? JSON.stringify(body) : undefined },
      requiresAuth
    );
  }

  async put<T>(endpoint: string, body?: any, requiresAuth = true): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'PUT', body: body ? JSON.stringify(body) : undefined },
      requiresAuth
    );
  }

  async patch<T>(endpoint: string, body?: any, requiresAuth = true): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'PATCH', body: body ? JSON.stringify(body) : undefined },
      requiresAuth
    );
  }

  async delete<T>(endpoint: string, requiresAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requiresAuth);
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// ============================================================================
// API Service Functions
// ============================================================================

// Authentication
export const authApi = {
  login: (credentials: LoginRequest) =>
    apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials, false),

  requestOtp: (data: OtpRequest) =>
    apiClient.post<{ message: string }>(API_ENDPOINTS.AUTH.PHONE_REQUEST_OTP, data, false),

  verifyOtp: (data: OtpVerifyRequest) =>
    apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.PHONE_VERIFY_OTP, data, false),

  refresh: (refreshToken: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken },
      false
    ),

  // Identity lives on /users/me; there is no /auth/me in the API reference.
  getMe: () => apiClient.get<User>(API_ENDPOINTS.USER.ME),
};

// User account (personal fields live here — backend-verified:
// PUT /couriers/me persists vehicle fields ONLY and silently ignores
// firstName/lastName/email/phone)
export const userApi = {
  // PUT /users/me accepts ONLY these four fields. `email` is returned by
  // GET /users/me but cannot be changed here, so sending it was a no-op.
  // Changing `phone` resets phoneVerified to false.
  updatePersonalInfo: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImageUrl?: string;
  }) => apiClient.put<User>(API_ENDPOINTS.USER.ME, data),
};

// Courier Profile
export const courierApi = {
  register: (data: CourierRegisterRequest) =>
    apiClient.post<CourierProfile>(API_ENDPOINTS.COURIER.REGISTER, data),

  getProfile: () => apiClient.get<CourierProfile>(API_ENDPOINTS.COURIER.ME),

  updateProfile: (data: CourierUpdateRequest) =>
    apiClient.put<CourierProfile>(API_ENDPOINTS.COURIER.ME, data),

  updateStatus: (status: CourierStatusType) =>
    apiClient.put<{ id: number; status: CourierStatusType; message: string }>(
      API_ENDPOINTS.COURIER.UPDATE_STATUS,
      { status }
    ),

  updateLocation: (location: LocationUpdate) =>
    apiClient.put<{ message: string }>(API_ENDPOINTS.COURIER.UPDATE_LOCATION, location),
};

// Orders
export const ordersApi = {
  getAvailableOrders: (lat?: number, lng?: number, radiusKm?: number) => {
    let endpoint = API_ENDPOINTS.COURIER.AVAILABLE_ORDERS;
    const params = new URLSearchParams();
    if (lat !== undefined) params.append('lat', lat.toString());
    if (lng !== undefined) params.append('lng', lng.toString());
    if (radiusKm !== undefined) params.append('radiusKm', radiusKm.toString());
    const queryString = params.toString();
    if (queryString) endpoint += `?${queryString}`;
    return apiClient.get<AvailableOrder[]>(endpoint);
  },

  getAvailableOrderDetails: (orderId: string | number) =>
    apiClient.get<AvailableOrder>(`${API_ENDPOINTS.COURIER.AVAILABLE_ORDERS}/${orderId}`),

  getActiveOrders: () => apiClient.get<ActiveOrder[]>(API_ENDPOINTS.COURIER.ACTIVE_ORDERS),

  getOrderDetail: (orderId: string | number) =>
    apiClient.get<ActiveOrder>(API_ENDPOINTS.ORDERS.DETAIL(orderId)),

  acceptOrder: (orderId: string | number) =>
    apiClient.post<ActiveOrder>(API_ENDPOINTS.ORDERS.ACCEPT(orderId)),

  pickupOrder: (orderId: string | number) =>
    apiClient.put<{ orderId: number; status: string; message: string }>(
      API_ENDPOINTS.ORDERS.PICKUP(orderId)
    ),

  startTransit: (orderId: string | number) =>
    apiClient.put<{ orderId: number; status: string; message: string }>(
      API_ENDPOINTS.ORDERS.TRANSIT(orderId)
    ),

  completeOrder: (orderId: string | number, data?: DeliveryCompleteRequest) =>
    apiClient.post<{ orderId: number; status: string; earnings: number; message: string }>(
      API_ENDPOINTS.ORDERS.COMPLETE(orderId),
      data
    ),

  reportIssue: (orderId: string | number, data: OrderIssueRequest) =>
    apiClient.post<{ message: string }>(API_ENDPOINTS.ORDERS.ISSUE(orderId), data),

  getOrderHistory: (page = 0, size = 20, dateFrom?: string, dateTo?: string) => {
    let endpoint = API_ENDPOINTS.COURIER.ORDER_HISTORY;
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return apiClient.get<{ content: ActiveOrder[]; totalElements: number; totalPages: number }>(
      `${endpoint}?${params.toString()}`
    );
  },
};

// Earnings
export const earningsApi = {
  getSummary: (period: EarningsPeriodType = 'THIS_WEEK', startDate?: string, endDate?: string) => {
    let endpoint = API_ENDPOINTS.COURIER.EARNINGS;
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiClient.get<EarningsSummary>(`${endpoint}?${params.toString()}`);
  },
};

// Notifications
export const notificationsApi = {
  getAll: () => apiClient.get<Notification[]>(API_ENDPOINTS.NOTIFICATIONS.LIST),

  getCounts: (userId: string | number) =>
    apiClient.get<{ unreadCount: number; totalCount: number }>(
      `${API_ENDPOINTS.NOTIFICATIONS.COUNTS(userId)}?role=COURIER`
    ),

  markAsRead: (id: string | number) =>
    apiClient.patch<{ message: string }>(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id)),

  readBatch: (ids: (string | number)[]) =>
    apiClient.patch<{ message: string }>(API_ENDPOINTS.NOTIFICATIONS.READ_BATCH, { ids }),

  dismiss: (id: string | number) =>
    apiClient.patch<{ message: string }>(API_ENDPOINTS.NOTIFICATIONS.DISMISS(id)),

  bulkAction: (action: 'READ' | 'DISMISS' | 'DELETE', ids: (string | number)[]) =>
    apiClient.post<{ message: string }>(API_ENDPOINTS.NOTIFICATIONS.BULK_ACTION, { action, ids }),
};

// Export all APIs
export const api = {
  auth: authApi,
  courier: courierApi,
  orders: ordersApi,
  earnings: earningsApi,
  notifications: notificationsApi,
  client: apiClient,
};

export default api;

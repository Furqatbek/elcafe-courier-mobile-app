/**
 * API Service Layer
 * Handles all HTTP requests with proper error handling, token management, and retry logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BASE_URL,
  API_ENDPOINTS,
  TOKEN_CONFIG,
  REQUEST_CONFIG,
  CourierStatusType,
  VehicleType,
  IssueType,
  EarningsPeriodType,
} from '@/constants/config';

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
  vehicleNumber: string;
  licenseNumber: string;
  preferredRadiusKm?: number;
}

export interface CourierUpdateRequest {
  vehicleType?: VehicleType;
  vehicleNumber?: string;
  preferredRadiusKm?: number;
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
  orderNumber: string;
  restaurant: Restaurant;
  deliveryAddress: DeliveryAddress;
  estimatedDistance: number;
  estimatedEarnings: number;
  itemCount: number;
  createdAt: string;
  expiresAt?: string;
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
  breakdown: Array<{
    date: string;
    earnings: number;
    deliveries: number;
  }>;
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
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.loadTokens();
  }

  private async loadTokens() {
    try {
      this.accessToken = await AsyncStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
      this.refreshToken = await AsyncStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      return null;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<string | null> {
    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        throw new AuthenticationError('Token refresh failed');
      }

      const data: ApiResponse<{ accessToken: string; refreshToken: string }> = await response.json();

      if (data.success) {
        this.accessToken = data.data.accessToken;
        this.refreshToken = data.data.refreshToken;
        await AsyncStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, data.data.accessToken);
        await AsyncStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, data.data.refreshToken);
        return data.data.accessToken;
      }

      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
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

    if (requiresAuth && this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
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

      // Handle 401 - try refresh
      if (response.status === 401 && requiresAuth) {
        const newToken = await this.refreshAccessToken();
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

  getMe: () => apiClient.get<User>(API_ENDPOINTS.AUTH.ME),
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

  getUnreadCount: () =>
    apiClient.get<{ count: number }>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT),

  markAsRead: (id: string | number) =>
    apiClient.put<{ message: string }>(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id)),
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

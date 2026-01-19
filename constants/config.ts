// API Configuration
export const BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '';

// API Endpoints
export const API_ENDPOINTS = {
  // tRPC endpoint for type-safe API calls
  TRPC: '/api/trpc',

  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
  },
  COURIER: {
    PROFILE: '/api/v1/courier/profile',
    UPDATE_PROFILE: '/api/v1/courier/profile',
    UPDATE_LOCATION: '/api/v1/courier/location',
    ORDERS: '/api/v1/courier/orders',
    STATS: '/api/v1/courier/stats',
    EARNINGS: '/api/v1/courier/earnings',
  },
  ORDERS: {
    LIST: '/api/v1/orders',
    DETAIL: (id: string) => `/api/v1/orders/${id}`,
    ACCEPT: (id: string) => `/api/v1/orders/${id}/accept`,
    PICKUP: (id: string) => `/api/v1/orders/${id}/pickup`,
    COMPLETE: (id: string) => `/api/v1/orders/${id}/complete`,
    CANCEL: (id: string) => `/api/v1/orders/${id}/cancel`,
  },
} as const;

// Request Configuration
export const REQUEST_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Token Configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_KEY: 'accessToken',
  REFRESH_TOKEN_KEY: 'refreshToken',
  USER_KEY: 'user',
  // Refresh token 5 minutes before expiry (if JWT)
  REFRESH_THRESHOLD_MS: 5 * 60 * 1000,
} as const;

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_REGION: {
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
  ZOOM_LEVEL: 15,
  ANIMATION_DURATION: 500,
  ROUTE_COLOR: '#4CAF50',
  MARKER_COLORS: {
    PICKUP: '#4CAF50',
    DROPOFF: '#FF5722',
    COURIER: '#2196F3',
  },
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_OFFLINE_MODE: false,
  ENABLE_BIOMETRIC_LOGIN: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_LOCATION_TRACKING: true,
  ENABLE_ANALYTICS: false,
  ENABLE_CHAT: true,
  ENABLE_RATINGS: true,
} as const;

// App Configuration
export const APP_CONFIG = {
  VERSION: '1.0.0',
  BUILD_NUMBER: '1',
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,
  PHONE_REGEX: /^\+?[\d\s-()]+$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SUPPORT_EMAIL: 'support@courierapp.com',
  SUPPORT_PHONE: '+1234567890',
} as const;

// Order Status Configuration
export const ORDER_STATUS_CONFIG = {
  REFRESH_INTERVAL: 30000, // 30 seconds
  MAX_ACTIVE_ORDERS: 5,
} as const;

// Location Configuration
export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 10000, // 10 seconds
  DISTANCE_FILTER: 10, // meters
  ACCURACY: 'high' as const,
} as const;

// Default Values
export const DEFAULTS = {
  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$',
  LANGUAGE: 'en',
  DATE_FORMAT: 'MM/DD/YYYY',
  TIME_FORMAT: 'h:mm A',
} as const;

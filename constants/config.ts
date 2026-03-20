// API Configuration
export const BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:8080';

// API Endpoints - Based on courier-app-api.md documentation
export const API_ENDPOINTS = {
  // tRPC endpoint for type-safe API calls
  TRPC: '/api/trpc',

  // Authentication endpoints
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    ME: '/api/v1/auth/me',
    LOGOUT: '/api/v1/auth/logout',
    PHONE_REQUEST_OTP: '/api/v1/auth/phone/request-otp',
    PHONE_VERIFY_OTP: '/api/v1/auth/phone/verify-otp',
  },

  // User endpoints
  USER: {
    LOGOUT_ALL: '/api/v1/users/me/logout-all',
  },

  // Courier profile & registration
  COURIER: {
    REGISTER: '/api/v1/couriers/register',
    ME: '/api/v1/couriers/me',
    UPDATE_STATUS: '/api/v1/couriers/me/status',
    UPDATE_LOCATION: '/api/v1/couriers/me/location',
    AVAILABLE_ORDERS: '/api/v1/couriers/me/available-orders',
    ACTIVE_ORDERS: '/api/v1/couriers/me/orders/active',
    ORDER_HISTORY: '/api/v1/couriers/me/orders/history',
    EARNINGS: '/api/v1/couriers/me/earnings',
  },

  // Order management endpoints
  ORDERS: {
    DETAIL: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}`,
    ACCEPT: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}/accept`,
    PICKUP: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}/pickup`,
    TRANSIT: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}/transit`,
    COMPLETE: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}/complete`,
    ISSUE: (orderId: string | number) => `/api/v1/couriers/me/orders/${orderId}/issue`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/api/v1/notifications/me',
    UNREAD_COUNT: '/api/v1/notifications/unread/count',
    MARK_READ: (id: string | number) => `/api/v1/notifications/${id}/read`,
  },

  // Device tokens for push notifications
  DEVICE_TOKENS: {
    REGISTER: '/api/v1/device-tokens',
    UNREGISTER: '/api/v1/device-tokens',
  },
} as const;

// Courier Status Values
export const COURIER_STATUS = {
  OFFLINE: 'OFFLINE',
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  ON_BREAK: 'ON_BREAK',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
} as const;

export type CourierStatusType = typeof COURIER_STATUS[keyof typeof COURIER_STATUS];

// Order Status Values
// Backend API uses: READY → PICKED_UP → IN_TRANSIT → DELIVERED
// App adds: PENDING, ACCEPTED for internal tracking
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  READY: 'READY',
  ACCEPTED: 'ACCEPTED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERING: 'DELIVERING', // Alias for IN_TRANSIT for backwards compatibility
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// Vehicle Types
export const VEHICLE_TYPES = {
  BICYCLE: 'BICYCLE',
  MOTORCYCLE: 'MOTORCYCLE',
  CAR: 'CAR',
} as const;

export type VehicleType = typeof VEHICLE_TYPES[keyof typeof VEHICLE_TYPES];

// Issue Types for reporting order issues
export const ISSUE_TYPES = {
  CUSTOMER_UNAVAILABLE: 'CUSTOMER_UNAVAILABLE',
  WRONG_ADDRESS: 'WRONG_ADDRESS',
  RESTAURANT_DELAY: 'RESTAURANT_DELAY',
  ACCIDENT: 'ACCIDENT',
  VEHICLE_ISSUE: 'VEHICLE_ISSUE',
  OTHER: 'OTHER',
} as const;

export type IssueType = typeof ISSUE_TYPES[keyof typeof ISSUE_TYPES];

// Notification Types
export const NOTIFICATION_TYPES = {
  NEW_ORDER_NEARBY: 'NEW_ORDER_NEARBY',
  ORDER_ASSIGNED: 'ORDER_ASSIGNED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  PAYOUT_ISSUED: 'PAYOUT_ISSUED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  RATING_RECEIVED: 'RATING_RECEIVED',
} as const;

// Earnings Period Types
export const EARNINGS_PERIOD = {
  TODAY: 'TODAY',
  THIS_WEEK: 'THIS_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  CUSTOM: 'CUSTOM',
} as const;

export type EarningsPeriodType = typeof EARNINGS_PERIOD[keyof typeof EARNINGS_PERIOD];

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
  COURIER_PROFILE_KEY: 'courierProfile',
  REFRESH_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes before expiry
} as const;

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_REGION: {
    latitude: 41.2995, // Tashkent default
    longitude: 69.2401,
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
  ENABLE_PHONE_LOGIN: true,
} as const;

// App Configuration
export const APP_CONFIG = {
  VERSION: '1.0.0',
  BUILD_NUMBER: '1',
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,
  PHONE_REGEX: /^\+?[\d\s-()]+$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  OTP_LENGTH: 6,
  OTP_RESEND_DELAY: 60, // seconds
  SUPPORT_EMAIL: 'support@courierapp.com',
  SUPPORT_PHONE: '+998901234567',
} as const;

// Location Update Intervals (in milliseconds)
export const LOCATION_CONFIG = {
  IDLE_INTERVAL: 30000, // 30 seconds when idle
  ACTIVE_INTERVAL: 5000, // 5 seconds during active delivery
  FAST_INTERVAL: 3000, // 3 seconds when moving fast
  BACKGROUND_INTERVAL: 60000, // 60 seconds in background
  DISTANCE_FILTER: 10, // meters
  ACCURACY: 'high' as const,
} as const;

// Order Configuration
export const ORDER_CONFIG = {
  REFRESH_INTERVAL: 30000, // 30 seconds
  MAX_ACTIVE_ORDERS: 3,
  NEW_ORDER_TIMEOUT: 300000, // 5 minutes to accept
} as const;

// Default Values
export const DEFAULTS = {
  CURRENCY: 'UZS',
  CURRENCY_SYMBOL: "so'm",
  LANGUAGE: 'en',
  DATE_FORMAT: 'DD/MM/YYYY',
  TIME_FORMAT: 'HH:mm',
  DEFAULT_RADIUS_KM: 10,
} as const;

// Navigation URLs for external map apps
export const NAVIGATION_URLS = {
  GOOGLE_MAPS: (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  YANDEX_MAPS: (lat: number, lng: number) =>
    `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`,
  APPLE_MAPS: (lat: number, lng: number) =>
    `maps://maps.apple.com/?daddr=${lat},${lng}`,
} as const;

// WebSocket Configuration (STOMP over SockJS)
export const WEBSOCKET_CONFIG = {
  // Native WebSocket endpoint for mobile apps
  URL: process.env.EXPO_PUBLIC_WS_URL || `${BASE_URL}/ws`,
  // SockJS endpoint for web browsers (with fallbacks)
  SOCKJS_URL: process.env.EXPO_PUBLIC_WS_SOCKJS_URL || `${BASE_URL}/ws-sockjs`,
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INCOMING: 10000,
  HEARTBEAT_OUTGOING: 10000,
  TOPICS: {
    NEW_ORDERS: '/user/queue/orders/new',
    ORDER_STATUS: (orderId: string | number) => `/topic/orders/${orderId}/status`,
    NOTIFICATIONS: '/user/queue/notifications',
  },
} as const;

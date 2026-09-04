// API Configuration
//
// Dev builds fall back to localhost; production builds MUST provide the API
// origin via EXPO_PUBLIC_RORK_API_BASE_URL and are forced onto TLS
// (http:// is upgraded to https://, ws:// to wss://).

/**
 * Upgrade plaintext transport schemes to their TLS equivalents
 * (http:// → https://, ws:// → wss://).
 * Pure (no __DEV__ dependency) so it is directly unit-testable.
 */
export const upgradeToSecureTransport = (url: string): string =>
  url.replace(/^http:\/\//i, 'https://').replace(/^ws:\/\//i, 'wss://');

/**
 * Production builds are forced onto TLS; dev builds pass through unchanged
 * (localhost over plain http/ws is fine there).
 *
 * Exported so every module that consumes an EXPO_PUBLIC_* URL directly
 * (lib/routing.ts, lib/crashReporting.ts) applies the same policy as the
 * API/WS URLs resolved here.
 */
export const enforceSecureTransport = (url: string): string => {
  if (__DEV__) {
    return url;
  }
  return upgradeToSecureTransport(url);
};

/**
 * True when an env value still carries an unreplaced template placeholder
 * (e.g. "REPLACE_ME_PROD_API_BASE_URL"). Placeholders are truthy strings, so
 * plain `if (!value)` guards never catch them — this check does.
 */
export const containsReplaceMePlaceholder = (value: string | undefined): boolean =>
  typeof value === 'string' && value.toUpperCase().includes('REPLACE_ME');

/**
 * Names of the env entries whose values still contain a REPLACE_ME
 * placeholder. Pure and testable — the module-load guard below feeds it the
 * real process.env values.
 */
export const findPlaceholderVars = (
  env: Record<string, string | undefined>
): string[] => Object.keys(env).filter((name) => containsReplaceMePlaceholder(env[name]));

// Every EXPO_PUBLIC_* variable the app consumes, listed literally — Expo
// inlines `process.env.EXPO_PUBLIC_X` at bundle time, so dynamic
// `process.env[name]` lookups do NOT work here.
const CONSUMED_EXPO_PUBLIC_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_RORK_API_BASE_URL: process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
  EXPO_PUBLIC_WS_URL: process.env.EXPO_PUBLIC_WS_URL,
  EXPO_PUBLIC_WS_SOCKJS_URL: process.env.EXPO_PUBLIC_WS_SOCKJS_URL,
  EXPO_PUBLIC_ROUTING_URL: process.env.EXPO_PUBLIC_ROUTING_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_CRASH_ENDPOINT: process.env.EXPO_PUBLIC_CRASH_ENDPOINT,
};

// Fail LOUDLY at startup instead of shipping a build where every network
// call silently targets a "REPLACE_ME_*" origin (see docs/PRODUCTION.md §1).
if (!__DEV__) {
  const placeholderVars = findPlaceholderVars(CONSUMED_EXPO_PUBLIC_ENV);
  if (placeholderVars.length > 0) {
    throw new Error(
      `Production build has unreplaced REPLACE_ME placeholder(s) in: ${placeholderVars.join(', ')}. ` +
      'Replace them with real values in .env before building (docs/PRODUCTION.md, section 1).'
    );
  }
}

const resolveBaseUrl = (): string => {
  const envBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (__DEV__) {
    return envBaseUrl || 'http://localhost:8080';
  }
  if (!envBaseUrl) {
    throw new Error('EXPO_PUBLIC_RORK_API_BASE_URL must be set for production builds');
  }
  return enforceSecureTransport(envBaseUrl);
};

export const BASE_URL = resolveBaseUrl();

// API Endpoints - Based on courier-app-api.md documentation
export const API_ENDPOINTS = {
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
    // Personal fields (firstName/lastName/email/phone) live on the USER
    // resource — PUT /couriers/me silently ignores them (backend-verified)
    ME: '/api/v1/users/me',
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
    COUNTS: (userId: string | number) => `/api/v1/notifications/user/${userId}/counts`,
    MARK_READ: (id: string | number) => `/api/v1/notifications/${id}/read`,
    READ_ALL: '/api/v1/notifications/read-all',
    READ_BATCH: '/api/v1/notifications/read-batch',
    DISMISS: (id: string | number) => `/api/v1/notifications/${id}/dismiss`,
    BULK_ACTION: '/api/v1/notifications/bulk-action',
  },

  // Device tokens for push notifications
  // NOTE: this endpoint does NOT use the standard { success, data } envelope —
  // it returns { success, message, tokenId } at the top level. Do not unwrap .data.
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
  SUSPENDED: 'SUSPENDED',
} as const;

// Only these three may be chosen by the courier. BUSY is set by the backend at
// the concurrent-order limit and SUSPENDED by an admin; the backend rejects
// self-service attempts to leave SUSPENDED or PENDING_APPROVAL.
export const SELECTABLE_COURIER_STATUSES = ['OFFLINE', 'AVAILABLE', 'ON_BREAK'] as const;

export type CourierStatusType = typeof COURIER_STATUS[keyof typeof COURIER_STATUS];

// Order Status Values
// Courier delivery flow: COURIER_ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
// READY = restaurant finished preparing (pickup is blocked server-side until then)
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  READY: 'READY',
  COURIER_ASSIGNED: 'COURIER_ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// Vehicle Types
export const VEHICLE_TYPES = {
  WALKING: 'WALKING',
  BICYCLE: 'BICYCLE',
  E_BIKE: 'E_BIKE',
  MOTORCYCLE: 'MOTORCYCLE',
  CAR: 'CAR',
} as const;

export type VehicleType = typeof VEHICLE_TYPES[keyof typeof VEHICLE_TYPES];

// Which vehicles legally carry a driving licence and a registration plate.
//
// Registration demanded both from EVERY courier, so an applicant on foot or on
// a bicycle had to invent a licence number and a number plate to get past the
// form - there is nothing valid they could have typed. This is the one place
// that decides it; the registration and vehicle-edit forms both read it, so
// they cannot drift apart (edit-vehicle already exempted bicycles from the
// plate but still demanded the licence).
//
// In Uzbekistan a bicycle and a courier on foot have neither document. An
// e-bike/scooter under the low-power threshold is likewise ridden without a
// driving licence and carries no plate; anything larger is registered as a
// MOTORCYCLE. If the operations team decides otherwise for a class, move it
// between these lists rather than editing a form.
export const VEHICLE_TYPES_REQUIRING_LICENSE: readonly VehicleType[] = [
  VEHICLE_TYPES.MOTORCYCLE,
  VEHICLE_TYPES.CAR,
];

export const VEHICLE_TYPES_REQUIRING_PLATE: readonly VehicleType[] = [
  VEHICLE_TYPES.MOTORCYCLE,
  VEHICLE_TYPES.CAR,
];

export const requiresLicense = (vehicleType: VehicleType): boolean =>
  VEHICLE_TYPES_REQUIRING_LICENSE.includes(vehicleType);

export const requiresPlate = (vehicleType: VehicleType): boolean =>
  VEHICLE_TYPES_REQUIRING_PLATE.includes(vehicleType);

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
  DISTANCE_FILTER: 10, // meters — OS delivery hint for watchPositionAsync
  // Client-side send gate. The OS hands us fixes far more often than the
  // backend needs them; this runs on the courier's battery and mobile data, so
  // a fix is only PUT when it is both new enough and far enough from the last
  // one we sent.
  MIN_SEND_INTERVAL_MS: 12000, // at most one update every ~12s
  MIN_SEND_DISTANCE_M: 20, // and only if moved ~20m
  // ...unless this long has passed, so a stationary courier's position does
  // not go stale server-side.
  SEND_HEARTBEAT_MS: 120000,
  ACCURACY: 'high' as const,
} as const;

// Order Configuration
export const ORDER_CONFIG = {
  REFRESH_INTERVAL: 30000, // 30 seconds
  // GET /couriers/me/available-orders is a poll, not a stream — the backend
  // exposes no courier-wide broadcast topic. Only runs while the app is
  // foregrounded AND the courier is online (see CourierContext).
  AVAILABLE_ORDERS_POLL_MS: 20000,
  // The backend sends order pushes on this exact Android channel id. Channel
  // importance is fixed at creation time, so renaming it requires a matching
  // backend change — do not edit casually.
  ANDROID_ORDER_CHANNEL_ID: 'orders_v2',
  MAX_ACTIVE_ORDERS: 3,
  NEW_ORDER_TIMEOUT: 300000, // 5 minutes to accept
  OFFER_TIMEOUT_SECONDS: 60, // client-side countdown on the new-order offer modal
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
  URL: enforceSecureTransport(process.env.EXPO_PUBLIC_WS_URL || `${BASE_URL}/ws`),
  // SockJS endpoint for web browsers (with fallbacks)
  SOCKJS_URL: enforceSecureTransport(process.env.EXPO_PUBLIC_WS_SOCKJS_URL || `${BASE_URL}/ws-sockjs`),
  // Aggressive first retry (the backend flips couriers OFFLINE when the
  // socket drops), then exponential backoff so a down server isn't hammered:
  // 3s -> 6s -> 12s ... capped at MAX_RECONNECT_DELAY. Resets after a
  // successful connect.
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_DELAY: 60000,
  MAX_RECONNECT_ATTEMPTS: 30,
  HEARTBEAT_INCOMING: 10000,
  HEARTBEAT_OUTGOING: 10000,
  // The backend's WebSocketDestinationAuthorizer checks EVERY SUBSCRIBE frame
  // and rejects anything outside this list with a STOMP ERROR — which closes
  // the connection. These four are the only destinations a courier may take.
  // Do not add a topic here without confirming the authorizer allows it.
  TOPICS: {
    // Orders this courier is a party to
    ORDER_UPDATES: (orderId: string | number) => `/topic/orders/${orderId}`,
    // Any authenticated user; used to drop an order from the available list
    // the moment another courier accepts it
    ORDER_TAKEN: (orderId: string | number) => `/topic/orders/${orderId}/taken`,
    // This courier's own personal notifications, keyed by USER id
    USER_NOTIFICATIONS: (userId: string | number) => `/topic/users/${userId}/notifications`,
    // This courier's own location echo, keyed by COURIER PROFILE id (not user id)
    COURIER_LOCATION: (courierId: string | number) => `/topic/couriers/${courierId}/location`,
  },
} as const;

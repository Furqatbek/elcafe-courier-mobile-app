/**
 * Formatting utilities for the Courier App
 */

import { DEFAULTS } from '@/constants/config';

// Currency formatting — UZS: integer so'm, thousands separators, symbol suffix.
// Deterministic (not device-locale dependent) so every screen shows the same string.
export const formatCurrency = (amount: number | null | undefined): string => {
  const value = Math.round(Number(amount) || 0);
  const grouped = Math.abs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${value < 0 ? '-' : ''}${grouped} ${DEFAULTS.CURRENCY_SYMBOL}`;
};

// Courier-facing offer/earnings amount: the courier earns delivery fee + tip.
// Use this everywhere an order's value to the COURIER is shown, so all screens agree.
export const courierEarnings = (order: {
  deliveryFee?: number | null;
  tipAmount?: number | null;
}): number => {
  return (order.deliveryFee ?? 0) + (order.tipAmount ?? 0);
};

// Whether an order carries a tip worth showing. Guards the tip row/badge in
// offer and detail screens so a zero/missing tip never renders "+0 so'm"
// (and a literal 0 never leaks into JSX as a text node).
export const hasTip = (order: { tipAmount?: number | null }): boolean => {
  return (order.tipAmount ?? 0) > 0;
};

// Distance formatting
export const formatDistance = (meters: number, useMetric: boolean = true): string => {
  if (useMetric) {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  } else {
    const miles = meters * 0.000621371;
    if (miles < 0.1) {
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }
};

// Duration formatting
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Parse a timestamp from the backend.
 *
 * CONFIRMED FORMAT: "2026-09-01T13:06:32Z" — trailing Z, second precision, no
 * fractional part. JacksonConfig pins it with a custom LocalDateTimeSerializer
 * (pattern yyyy-MM-dd'T'HH:mm:ss'Z'), and the backend has a test that fails
 * the build if it ever changes. So `new Date(raw)` is already correct and this
 * helper is a pass-through for real payloads.
 *
 * It stays because the fallback is cheap insurance: a naive, suffix-less
 * timestamp is parsed by JavaScript as LOCAL time, which in Tashkent (UTC+5)
 * would silently put every value 5 hours out — an order created a minute ago
 * rendering as "5h ago". If the serializer is ever changed, this degrades to
 * "still correct" instead of "quietly wrong everywhere".
 *
 * NOTE: second precision means two events in the same second are
 * indistinguishable here. Never sort by these values — the list endpoints are
 * already ordered by the server; keep their order.
 */
export const parseServerDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
};

/**
 * Great-circle distance in metres between two coordinates (haversine).
 * Used to decide whether a location fix is worth sending to the backend.
 */
export const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Time formatting
export const formatTime = (date: Date | string, locale: string = 'en-US'): string => {
  const d = parseServerDate(date);
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Date formatting
export const formatDate = (date: Date | string, locale: string = 'en-US'): string => {
  const d = parseServerDate(date);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Relative time formatting (e.g., "2 hours ago", "in 5 minutes")
export const formatRelativeTime = (date: Date | string): string => {
  const d = parseServerDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 0) {
    // Future time
    const absDiffMinutes = Math.abs(diffMinutes);
    if (absDiffMinutes < 60) {
      return `in ${absDiffMinutes} min`;
    }
    const absDiffHours = Math.abs(diffHours);
    return `in ${absDiffHours} hr`;
  }

  if (diffSeconds < 60) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  if (diffDays === 1) {
    return 'yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return formatDate(d);
};

// Phone number formatting
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // International format
  if (cleaned.length > 10) {
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
  }

  return phone;
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

// Capitalize first letter
export const capitalize = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Format order ID for display
export const formatOrderId = (id: string): string => {
  return `#${id.toUpperCase()}`;
};

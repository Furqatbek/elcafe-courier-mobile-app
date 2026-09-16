import type { NewOrderNotification } from '@/services/websocket';

/**
 * Parse a NEW_DELIVERY_AVAILABLE push into the offer the app already renders.
 *
 * Why this exists: push is the PRIMARY channel for new-order alerts, not a
 * fallback for the WebSocket. A socket only delivers while the app is open and
 * connected; a courier with the app backgrounded — which is most of the time,
 * because they are riding — is reachable only through FCM/APNs. It also costs
 * the backend nothing to hold open.
 *
 * The parsing is fiddly for one reason worth stating: **FCM data payloads are
 * `Map<String, String>`.** Every value arrives as a string, so `orderId` is
 * `"77"`, `deliveryFee` is `"15000"`, and a missing number is `""` rather than
 * absent. APNs custom keys, by contrast, keep their JSON types. The same app
 * code handles both platforms, so everything is coerced here rather than at a
 * dozen call sites — and a value that cannot be coerced becomes `undefined`,
 * never `NaN`, which would render as "NaN so'm" on the offer card.
 */

/** Number from an FCM string, an APNs number, or nothing. Never NaN. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  // Number('') is 0 and Number('12abc') is NaN — both are wrong answers here.
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Non-empty string, or nothing. Empty strings are FCM's way of saying null. */
export function toText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (typeof value === 'number') return String(value);
  return undefined;
}

/**
 * True when the payload carries enough to show a courier a useful offer.
 *
 * An offer with no restaurant, no money and no destination is worse than no
 * modal: the courier accepts blind or dismisses out of confusion. When this is
 * false the caller refetches the order list instead of rendering a shell — the
 * push has still done its job, which was to wake the app.
 */
export function isOfferRenderable(offer: NewOrderNotification): boolean {
  const hasMoney = (offer.deliveryFee ?? 0) > 0 || (offer.total ?? 0) > 0;
  const hasPlace = !!offer.restaurantName || !!offer.deliveryAddress;
  return hasMoney && hasPlace;
}

/**
 * Build a NewOrderNotification from a push `data` payload.
 *
 * Returns null when there is no usable order id — without one there is nothing
 * to accept, refetch, or navigate to.
 */
export function parseNewOrderPush(
  data: Record<string, unknown> | null | undefined
): NewOrderNotification | null {
  if (!data || typeof data !== 'object') return null;

  const orderId = toNumber(data.orderId);
  if (orderId === undefined || orderId <= 0) return null;

  return {
    type: 'NEW_ORDER',
    orderId,
    // `orderNumber` is what earlier builds of the backend sent; the API calls
    // it externalOrderNo. Accept both so a backend mid-rollout works.
    externalOrderNo: toText(data.externalOrderNo) ?? toText(data.orderNumber),
    restaurantId: toNumber(data.restaurantId) ?? 0,
    restaurantName: toText(data.restaurantName),
    restaurantAddress: toText(data.restaurantAddress),
    restaurantLat: toNumber(data.restaurantLat),
    restaurantLng: toNumber(data.restaurantLng),
    restaurantDistance: toNumber(data.restaurantDistance),
    deliveryAddress: toText(data.deliveryAddress),
    deliveryLat: toNumber(data.deliveryLat),
    deliveryLng: toNumber(data.deliveryLng),
    deliveryDistance: toNumber(data.deliveryDistance),
    deliveryFee: toNumber(data.deliveryFee),
    tipAmount: toNumber(data.tipAmount),
    total: toNumber(data.total),
    itemCount: toNumber(data.itemCount) ?? 0,
    createdAt: toText(data.createdAt),
    readyAt: toText(data.readyAt),
    expiresAt: toText(data.expiresAt),
  };
}

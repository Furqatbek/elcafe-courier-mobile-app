# Backend questions — contracts the app currently assumes

These are the places the courier app was integrated against a shape we
*guessed* rather than one that is written down. Each one is a spot where the
app can silently show wrong data or do redundant work if our guess is off. None
is a crisis; the app degrades safely in every case. But confirming them lets us
delete the fallbacks and stop guessing.

For each: **please confirm the exact field name, casing, type, and unit**, and
whether the field is always present or can be omitted.

---

## 1. Status-change push payload — can we skip the refetch entirely?

When an order's status changes server-side, the courier device finds out two
ways:

- **WebSocket** `/topic/orders/{orderId}` delivers the full `OrderDto`. We patch
  local state from it directly — no HTTP call. This is the good path.
- **FCM data push** — currently only tells us "something about order N changed."
  We react by refetching, and only when the socket is down.

**Question:** does the status-change FCM data push already carry the new
`status` (and ideally the other `OrderDto` money/timestamp fields)? If it does,
we can patch state straight from the push exactly like the socket does, and
never refetch. Please list the exact keys and values the status push sends.

Related: FCM data values arrive as strings. Confirm that is intended for every
field (we coerce, so it is fine either way — we just want it documented).

## 2. Notification `type` values

The app branches on `data.type`. It only handles `NEW_DELIVERY_AVAILABLE`
explicitly; everything else falls through to a generic toast + list refresh.

**Question:** what is the complete list of `type` strings the backend sends to
couriers, with exact spelling/casing? We have these constants defined but are
not sure they match what you send:
`NEW_ORDER_NEARBY`, `ORDER_ASSIGNED`, `ORDER_CANCELLED`, `PAYOUT_ISSUED`,
`VERIFICATION_APPROVED`, `RATING_RECEIVED`. Which of these are real, and are
there others (e.g. an order-status-advanced type)?

Also: `data.orderId` and `data.actionUrl` — confirm these keys, and the
`actionUrl` format (we parse `/orders/(\d+)` out of it).

## 3. `POST /couriers/me/orders/{id}/complete` — response body

The reference says this endpoint *credits* `deliveryFee + tipAmount` to the
courier, but does not document the **response body**. The app expected
`data.earnings` and showed "You earned 0" when it was absent (now fixed with a
local fallback).

**Question:** what does `/complete` return in `data`? Specifically, is there an
authoritative `earnings` figure we should display instead of computing it
locally? If so, name the field.

Also confirm: does `/complete` accept a body at all? The app can send
`{ deliveryPhoto?, deliveryNotes? }` but never does (no image picker). Should we
stop sending a body entirely?

## 4. `OrderDto` over WebSocket — field names

We read these off the socket `OrderDto` and want them confirmed (name + casing):

`id` (note: the list endpoints use `orderId`, the socket uses `id` — is that
intended?), `status`, `customerName`, `customerPhone`, `restaurantPhone`,
`deliveryFee`, `tipAmount`, `total`, `readyAt`, `pickedUpAt`, `deliveredAt`.

## 5. Active-orders / order-details — `itemCount` vs `items`

The detail screen shows an item count from `order.itemCount`, falling back to
`order.items?.length`, then `0`.

**Question:** for the active-orders list and the order-details endpoint, do you
return `itemCount`, an `items[]` array, both, or neither? If the count is shown
as `(0)` when an order clearly has items, this is why. If `items[]` exists,
what are its fields (we render `{quantity}x {name}`)?

## 6. Units and formats, across the board

Confirm once so every screen agrees:

- **Money** (`deliveryFee`, `tipAmount`, `total`, all earnings) — integer so'm?
  Or minor units (tiyin ×100)? We treat them as integer so'm.
- **Distance** (`estimatedDistance`, `pickupDistance`, `deliveryDistance`) —
  meters? We format assuming meters.
- **Timestamps** (`createdAt`, `readyAt`, `pickedUpAt`, `deliveredAt`,
  `expiresAt`) — ISO 8601 in UTC?

## 7. `GET /couriers/me/earnings` — field names

We read: `todayEarnings`, `weekEarnings`, `monthEarnings`, `totalEarnings`,
`cashEarnings`, `cardEarnings`, `withdrawableBalance`, `todayDeliveries`,
`weekDeliveries`, `monthDeliveries`, `totalDeliveries`, `averagePerDelivery`.

**Question:** do these names and casing match the response exactly? Any that
don't exist are silently showing 0.

## 8. Still open from before (recap)

- **`PUT /couriers/me` and `PUT /couriers/me/status`** return
  `404 profile with id={ID} not found`, while `GET` on the same path works.
  Looks like the PUT handlers resolve by the wrong id. Status.
- **`/api/v1/app/version`** — `storeUrl` still points at `app.zbr.customer`
  (should be `app.zbr.courier`); iOS store URL missing; `latestVersion` stale.
  See BACKEND_PUSH_INTEGRATION.md appendix for the exact values.

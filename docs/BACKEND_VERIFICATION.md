# Backend Verification Checklist — ZBR Courier

Every assumption below is baked into this client but **cannot be verified from
this repository** — the Spring backend lives elsewhere and `courier-app-api.md`
has provably drifted from the code (see item 4). Run this checklist against the
real backend (staging is fine if it runs the same code) **before launch**. Each
item lists: what the app assumes, where in code, a ≤5-minute verification, and
the blast radius if the assumption is wrong.

Conventions used below: `BASE` = the value of `EXPO_PUBLIC_RORK_API_BASE_URL`;
`$TOKEN` = a valid courier access token (log in via the app or
`POST $BASE/api/v1/auth/login`, copy `accessToken`).

---

## 1. STOMP `/topic/**` subscription authorization (PII exposure)

- **App assumes:** the broker authorizes every SUBSCRIBE frame, because
  personal data rides on *open broadcast* destinations:
  `/topic/orders/{orderId}` (full OrderDto incl. `customerName`,
  `customerPhone`, `deliveryAddress`, `deliveryInstructions`),
  `/topic/users/{userId}/notifications` (the client's own comment calls the
  principal-bound `/user/queue/notifications` "dead"), and
  `/topic/couriers/{courierId}/location` (live courier positions).
- **Where:** `constants/config.ts` → `WEBSOCKET_CONFIG.TOPICS`;
  `services/websocket.ts` (subscribe helpers, OrderDto shape at the top).
- **Verify (5 min):** with courier A's token, open a raw STOMP session
  (`npx wscat -c "$WS_URL"` + manual CONNECT/SUBSCRIBE frames, or a 20-line
  stompjs Node script) and SUBSCRIBE to `/topic/orders/{id}` for an order
  belonging to courier B, and to `/topic/users/{B_userId}/notifications`. If
  the broker accepts the subscription and delivers frames, **fail**. In Spring,
  plain `/topic/**` is broadcast to any connected client unless a
  `ChannelInterceptor` checks each SUBSCRIBE — ask the backend team to point at
  that interceptor.
- **Blast radius if wrong:** any self-registered courier account can harvest
  customer names, phones, and home addresses for *every* order by ID
  enumeration, read other users' notifications, and track all couriers live.
  Reportable data breach; launch blocker.

## 2. Refresh-token rotation semantics (reuse tolerated or revoked?)

- **App assumes (inconsistently — this is why it matters):** comments in
  `services/api.ts` say a rotated refresh token is single-use ("never
  double-spent"). But the app has **three independent refresh stacks**
  (`services/api.ts` `refreshPromise`, `context/CourierContext.tsx`
  `refreshInFlightRef`, `lib/backgroundLocation.ts`
  `backgroundRefreshInFlight`) that don't share a mutex and can each POST
  `/api/v1/auth/refresh` with the same token.
- **Where:** `services/api.ts` (refresh + 401 handling),
  `context/CourierContext.tsx` (logout on refresh 401),
  `lib/backgroundLocation.ts` (storage-only token writes).
- **Verify (5 min):** call `POST $BASE/api/v1/auth/refresh` twice with the
  *same* refresh token. Record: does the second call succeed (reuse tolerated),
  fail with 401 (strict rotation), or fail AND revoke the whole session family
  (reuse-detection)? Also confirm whether the refresh response returns a new
  refresh token at all.
- **Blast radius if wrong:** with strict rotation, the client's uncoordinated
  stacks force-logout couriers mid-delivery (the external-navigation flow makes
  this a routine occurrence, not an edge case). If reuse is tolerated, severity
  drops to "sloppy but survivable" and the client fix can be post-launch.
  This answer decides the priority of the token-refresh unification work.

## 3. `POST /api/v1/device-tokens`: Expo push token vs raw FCM token

- **App assumes:** the backend accepts `{ deviceToken: "ExponentPushToken[…]",
  deviceType: "IOS"|"ANDROID" }` and sends pushes **through Expo's Push API**
  (`https://exp.host/--/api/v2/push/send`), because the client registers the
  token from `Notifications.getExpoPushTokenAsync(...)` — that token is
  meaningless to raw FCM/APNs.
- **Where:** `services/pushNotification.ts` (`getExpoPushTokenAsync`, the
  `deviceToken` POST body); endpoint constants in `constants/config.ts` →
  `API_ENDPOINTS.DEVICE_TOKENS` (also undocumented in `courier-app-api.md`).
- **Verify (5 min):** grep the backend for `exp.host` / an Expo server SDK
  (`expo-server-sdk-java`, etc.). If it instead calls FCM
  (`fcm.googleapis.com`) with the stored token, **fail**. Then send one test
  push end-to-end: register a real device, trigger a backend notification,
  confirm arrival with the app backgrounded.
- **Blast radius if wrong:** every push is silently dead — including
  `NEW_DELIVERY_AVAILABLE`, the app's only order-alert channel when the
  WebSocket is down. Couriers miss orders and never know why. Launch blocker.

## 4. Notifications REST API: path/method divergences from the documented contract

`courier-app-api.md` documents exactly three notification endpoints
(`GET /notifications`, `GET /notifications/unread/count`,
`PUT /notifications/{id}/read`). The client calls all of the following — each
one must be confirmed to exist with this exact path AND method:

| # | Client call | Doc says | Where |
|---|---|---|---|
| 4a | `GET /api/v1/notifications/me` | `GET /notifications` | `API_ENDPOINTS.NOTIFICATIONS.LIST`, fetched in `context/CourierContext.tsx` |
| 4b | `PATCH /api/v1/notifications/{id}/read` | **PUT** `/notifications/{id}/read` | `markNotificationAsRead` in `context/CourierContext.tsx` |
| 4c | `PATCH /api/v1/notifications/read-all?userId={id}&role=COURIER` | not documented | `markAllNotificationsAsRead` in `context/CourierContext.tsx` |
| 4d | `GET /api/v1/notifications/user/{userId}/counts?role=COURIER` | not documented | `API_ENDPOINTS.NOTIFICATIONS.COUNTS` |
| 4e | `POST /api/v1/notifications/read-batch` | not documented | `API_ENDPOINTS.NOTIFICATIONS.READ_BATCH` / `services/api.ts` |
| 4f | `PATCH /api/v1/notifications/{id}/dismiss` | not documented | `API_ENDPOINTS.NOTIFICATIONS.DISMISS` / `services/api.ts` |
| 4g | `POST /api/v1/notifications/bulk-action` | not documented | `API_ENDPOINTS.NOTIFICATIONS.BULK_ACTION` / `services/api.ts` |
| 4h | push/WS payload `type: "NEW_DELIVERY_AVAILABLE"` | doc lists only `NEW_ORDER_NEARBY`, `ORDER_ASSIGNED`, … | foreground handler in `app/_layout.tsx` |

- **Verify (5 min):** `curl -s -o /dev/null -w '%{http_code}\n' -H
  "Authorization: Bearer $TOKEN"` each path with the client's method (expect
  200/204), then repeat 4b with PUT to see which method the backend actually
  mounts. For 4h, trigger one new-order event and dump the JSON `type` field.
- **Blast radius if wrong:** notifications screen empty/erroring, unread badge
  stuck, mark-read/dismiss/bulk dead (404/405), and foreground new-order pushes
  falling through to the generic toast instead of the offer modal.

## 5. `DELETE /api/v1/users/me` (account deletion)

- **App assumes:** the endpoint exists and hard-deletes (or schedules deletion
  of) the account. Not present in `courier-app-api.md`.
- **Where:** `app/(tabs)/settings.tsx` (delete-account flow, ~line 184).
- **Verify (5 min):** on a throwaway account:
  `curl -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/api/v1/users/me` —
  expect 200/204, then confirm login fails afterwards.
- **Blast radius if wrong:** account deletion errors out. Both stores
  **require** in-app account deletion for apps with account creation — a
  broken flow is a store-review rejection, not just a bug.

## 6. `POST /api/v1/couriers/me/orders/{orderId}/rating`

- **App assumes:** couriers can rate a completed order via this endpoint.
  Not in `courier-app-api.md`.
- **Where:** `app/order-rating/[orderId].tsx` (~line 71). Note: this screen is
  **force-shown after every completed delivery** (non-cancelable success alert
  routes into it from `app/order/[id].tsx` and `app/map-navigation/[orderId].tsx`).
- **Verify (5 min):** complete a test order, then
  `curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'
  -d '{"rating":5,"comment":"test"}' $BASE/api/v1/couriers/me/orders/{id}/rating`.
- **Blast radius if wrong:** the mandatory end-of-delivery screen errors on
  submit for *every single delivery* (Retry/Skip escape hatch exists, but it's
  the last thing a courier sees each job — trust-destroying).

## 7. `GET /api/v1/couriers/me/reviews`

- **App assumes:** paginated reviews at
  `/api/v1/couriers/me/reviews?page={p}&size={s}`. Not in `courier-app-api.md`.
- **Where:** `app/reviews.tsx` (~line 24).
- **Verify (5 min):** `curl -H "Authorization: Bearer $TOKEN"
  "$BASE/api/v1/couriers/me/reviews?page=0&size=10"` — confirm 200 and the
  field names the screen renders (rating, comment, createdAt, orderId).
- **Blast radius if wrong:** the Reviews screen shows a permanent load error.
  Annoying but contained to one screen.

## 8. Earnings response fields beyond the documented schema

- **App assumes:** `GET /api/v1/couriers/me/earnings` returns
  `todayEarnings`, `averagePerDelivery`, `cashEarnings`, `cardEarnings`, and
  `withdrawableBalance`. The documented response has only `period`,
  `totalEarnings`, `deliveryFees`, `tips`, `totalDeliveries`,
  **`avgPerDelivery`** (note the name difference vs `averagePerDelivery`),
  `onlineHours`, `breakdown`.
- **Where:** `app/(tabs)/finance.tsx` (lines ~155, 165, 187, 203, 222);
  defaults spread in `context/CourierContext.tsx` (`DEFAULT_EARNINGS`) make
  every absent field render as `0`.
- **Verify (5 min):** `curl -H "Authorization: Bearer $TOKEN"
  "$BASE/api/v1/couriers/me/earnings?period=TODAY" | jq keys` on an account
  with at least one completed delivery.
- **Blast radius if wrong:** the Finance screen shows Cash = 0 so'm next to a
  non-zero Total, plus a bogus "withdrawable" balance — couriers reconcile
  cash-in-hand against this screen, so wrong zeros mean payout disputes and
  support tickets in week one.

## 9. Auto-offline on socket drop + `PUT` vs `PATCH` on `/couriers/me/status`

- **App assumes:** (a) the backend **flips a courier OFFLINE when their
  WebSocket drops** — the client's aggressive reconnect and its
  status-re-assert-on-reconnect logic exist *only* to compensate for this
  (comments in `services/websocket.ts` ~line 287 and
  `constants/config.ts` `WEBSOCKET_CONFIG`); (b) status changes are accepted
  as `PUT /api/v1/couriers/me/status` — both call sites use PUT
  (`services/api.ts` `updateStatus`, `context/CourierContext.tsx` ~line 1521),
  matching the doc; confirm the real controller mounts PUT (not PATCH) and
  tolerates the re-assert (same-status PUT is idempotent, no error).
- **Verify (5 min):** go online in the app, kill the network for ~30 s, ask the
  backend team (or query the DB / `GET /couriers/me`) whether status flipped to
  OFFLINE; then `curl -X PUT -H "Authorization: Bearer $TOKEN" -H
  'Content-Type: application/json' -d '{"status":"AVAILABLE"}'
  $BASE/api/v1/couriers/me/status` twice — both should 200. Repeat once with
  `-X PATCH` to document which methods are mounted.
- **Blast radius if wrong:** if the backend does *not* auto-offline, the
  client's reconnect-re-assert can silently overwrite a dispatcher-set status
  (e.g. flipping a BUSY/suspended courier back to AVAILABLE). If it *does*
  auto-offline but PUT semantics differ, couriers drop off the dispatch pool
  after every network blip and don't come back.

## 10. `ORDER_TAKEN` broadcast semantics

- **App assumes:** when another courier accepts an order, the backend
  publishes an `ORDER_TAKEN` message **both** on the shared available-orders
  topic (`/topic/couriers/orders/available` — the same channel that carries
  new-order payloads; messages distinguished by `type === 'ORDER_TAKEN'`)
  **and** on the per-order `/topic/orders/{orderId}/taken`. The client uses
  these to dismiss the offer modal and prune the available list.
- **Where:** `services/websocket.ts` (~lines 32, 349–380),
  `context/CourierContext.tsx` (`handleOrderTaken`, ~line 869). Note the known
  client gap: the orders-tab offer modal keeps its own local copy and does not
  consume the taken event (audit finding, owned elsewhere) — backend semantics
  still need confirming for the fix to work.
- **Verify (5 min):** two test courier accounts, both online; accept an order
  with account A while account B has the offer visible and a STOMP debug
  session subscribed to both destinations — confirm which destination(s)
  actually emit, and the exact payload shape (`{ type: 'ORDER_TAKEN', orderId }`?).
- **Blast radius if wrong:** couriers race to accept already-taken orders and
  hit rejection alerts all day at peak hours; stale offers count down on dead
  orders.

## 11. Remaining unverifiable assumptions (from the audit, verify opportunistically)

1. **Timestamps are ISO-8601 UTC with `Z`** (doc asserts it): a zone-less
   `LocalDateTime` serialization silently shifts every "x min ago" by +5 h in
   Tashkent. Check one order payload's `createdAt` for the trailing `Z`.
2. **JWT sizes stay under expo-secure-store's 2048-byte per-value limit**
   (`services/api.ts` token storage): decode a production token and check
   `echo -n "$TOKEN" | wc -c`. Oversized tokens fail to persist → login loops.
3. **Undocumented auth/user endpoints exist**: `POST /api/v1/auth/register`,
   `POST /api/v1/auth/logout`, `POST /api/v1/users/me/logout-all`,
   `PUT /api/v1/users/me` — curl each once.
4. **`PUT /api/v1/couriers/me` accepts personal fields**: `app/edit-profile.tsx`
   sends `firstName/lastName/email/phone` but the doc says the endpoint takes
   only vehicle fields — check whether personal-field updates persist.
5. **Routing service capacity**: `EXPO_PUBLIC_ROUTING_URL` must point at a
   self-hosted OSRM-compatible server that survives production QPS; the public
   demo server throttles and leaks coordinates to a third party (dev only).

---

## Appendix A — QA cases for phone normalization (`normalizePhone`, `app/login-otp.tsx`)

The OTP login screen normalizes user input before `POST
/api/v1/auth/phone/request-otp`. The function strips non-digits; a 12-digit
string starting `998` gets `+` prefixed; **everything else gets `+998`
prefixed wholesale**. The backend must therefore expect E.164 `+998XXXXXXXXX`,
and QA should exercise these exact cases (unit-testable once the function is
extracted from the screen component — it currently lives inline, so these are
manual/QA cases):

| Input | Expected request value | Note |
|---|---|---|
| `901234567` | `+998901234567` | bare 9-digit local number |
| `90 123 45 67` | `+998901234567` | spaces stripped |
| `(90) 123-45-67` | `+998901234567` | punctuation stripped |
| `998901234567` | `+998901234567` | full number without `+` |
| `+998 90 123 45 67` | `+998901234567` | full E.164 with formatting |
| `+998901234567` | `+998901234567` | already normalized |
| `8901234567` (10 digits) | `+9988901234567` | **13 digits — invalid; current code does NOT reject.** Backend must 400 it |
| `+7 900 123 45 67` | `+9987900123456 7`→`+99879001234567` | **foreign number mangled — current code cannot represent non-Uzbek numbers.** Backend must 400 it |
| `` (empty) | `+998` | degenerate; client validates non-empty first, but backend must still 400 it |

Backend-side verification: confirm `request-otp` rejects malformed values
(the last three rows) with a 4xx and a message the app can surface, rather
than silently queuing SMS to garbage numbers.

---

# RESOLUTION — Backend team response (2026-07-05)

Backend verified all 11 items (`COURIER_VERIFICATION_RESPONSE.md` in the
backend repo). Status per item, and the app-side reconciliation shipped in
this commit:

| # | Item | Outcome | App-side action taken |
|---|------|---------|----------------------|
| 1 | STOMP subscribe auth | **FIXED backend-side** — `WebSocketDestinationAuthorizer` checks every SUBSCRIBE; `/topic/orders/{id}` party-to-order only | Denied-SUBSCRIBE ERROR frames now logged unmissably (`services/websocket.ts`); our subscriptions are all within courier scope |
| 2 | Refresh rotation | Reuse-tolerant, **never rotated** — same refresh token returned | None needed (tokenManager already handles non-rotating refresh; its rotation safety stays as future-proofing). **Decision: accept for MVP — recommended YES** |
| 3 | Expo vs FCM push | **RESOLVED** — app now registers NATIVE tokens (`getDevicePushTokenAsync`: FCM registration token on Android, raw APNs token on iOS); backend keeps Firebase Admin + direct APNs with its own keys. Expo push service unused. | Native-token registration shipped; `deviceType` field routes platform |
| 4 | Notifications API | 4b/4c/4e corrected | App already used PATCH `/read`; `read-all` userId now mandatory-guarded; `read-batch` unused; `COURIER_ASSIGNED` added to type maps |
| 5 | DELETE /users/me | **Shipped** | Already wired ✓ |
| 6 | Order rating | **Shipped** — `{rating, comment}` only | Payload aligned; tags folded into comment |
| 7 | Reviews field | `courierRating` | Already using it ✓ |
| 8 | Earnings fields | Confirmed; **period/date params IGNORED** | Date-range picker removed from finance (was lying UI); fetch sends no params |
| 9a | Auto-offline | Confirmed (AVAILABLE/ON_BREAK only) | Client mirror already matches ✓ |
| 9b | Status endpoint | PUT+PATCH both work, idempotent; SUSPENDED self-clear guard deferred | **Decision: approve deferral — recommended YES** with note it must land before admin suspension flow ships |
| 10 | ORDER_TAKEN | Confirmed exactly as implemented | None ✓ |
| 11.1 | Timestamp Z suffix | **CHANGED** — all timestamps now UTC with `Z` | Verified: no manual `Z` appends in app; `new Date()` parsing correct. Test on stage before deploy |
| 11.2 | JWT claims | Tiny token, no roles | App only decodes `exp` ✓; role comes from API responses ✓ |
| 11.4 | PUT /couriers/me | Vehicle fields ONLY — personal fields silently ignored | edit-profile now saves personal fields via `PUT /users/me` (`userApi.updatePersonalInfo`) — was a silent no-op |
| 11.5 | OSRM | Backend defaults to public demo | Ops: set `DELIVERY_ROUTING_OSRM_URL` backend-side (app-side env already gated) |
| A | Phone/OTP validation | Fixed backend-side; accepts `+998XXXXXXXXX` | Our normalizePhone output matches ✓ |

## Push token format (Item 3) — RESOLVED

Decision: the app registers **native device tokens** via
`getDevicePushTokenAsync` — FCM registration token on Android, raw APNs
device token on iOS — routed by the `deviceType` field. The backend keeps its
existing Firebase Admin (Android) and direct APNs (iOS) senders with the
platform keys already provisioned to it. No Expo transport needed on either
side.

Backend note: expect `deviceToken` values that are NOT `ExponentPushToken[…]`
— Android tokens are FCM registration strings, iOS tokens are APNs hex
strings. Route on `deviceType` (`ANDROID` → Firebase Admin, `IOS` → APNs).
Verify one test push per platform (foreground, background, killed) during the
staging pass.

---

# Backend clarifications (2026-09-02)

Three corrections from the backend team, after they re-read the source.

## Timestamps — the integration doc was wrong, the javadoc was right

Real format: `2026-09-01T13:06:32Z` — **trailing Z, second precision, no
fractional seconds**. `JacksonConfig` registers a custom
`LocalDateTimeSerializer` with pattern `yyyy-MM-dd'T'HH:mm:ss'Z'`, and the
backend now has a test that fails the build if that changes.

So `new Date(raw)` is correct on its own: do not append a Z, do not strip one.
`lib/formatting.ts parseServerDate()` is a pass-through for this format and is
kept only as insurance against a future regression to a naive string.

**Milliseconds are truncated, not rounded.** Two events in the same second are
indistinguishable by these values, so nothing in this app sorts by them — the
list endpoints arrive already ordered by the server and that order is preserved.

*For the other apps:* appending `Z` defensively is a harmless no-op on a string
that already ends in Z, but stripping or reformatting is not — worth checking
in the customer and vendor clients.

## appId — send the real bundle id, though nothing filters on it

Push targets every active token for the user
(`findByUserIdAndActiveTrue`), with no `appId` condition. The field is used in
exactly one place: on iOS it becomes the `apns-topic` header, and **APNs
rejects a push whose topic is not the app's own bundle id**. We send
`Application.applicationId` (`app.zbr.courier`), which costs nothing while
Android-only and means iOS works on the day it ships. The `uz.zbr.courier` in
the earlier doc was an invented placeholder.

**Known consequence:** a courier *is* a consumer account — the same user row. If
someone installs both the courier app and the customer app under one phone
number, a courier push lands on **both**. `appId` is the field that would let
the backend route by app, and today nothing does. Report it to the backend team
if it starts showing up in testing.

## restaurantPhone — added to the payload

`CourierOrderDto` previously carried only `customerPhone`, which is why the
restaurant-call affordance was removed from the order screen: it dialled the
customer. The backend added `restaurantPhone` to **every** courier order
endpoint (available-orders, active, history, single order), with a test
asserting the two numbers actually differ — "field exists but is always null"
being the exact bug class worth guarding.

App side: `restaurantPhone` is now on the `Order`/`AvailableOrder` interfaces
and the WS `OrderDto`, a "Call restaurant" action is back on the order screen
(rendered only when a number is present), and the *not ready for pickup* flow
keeps the courier on the order screen, surfaces the backend's own message, and
offers the kitchen's number so they can chase the food and retry the slider.

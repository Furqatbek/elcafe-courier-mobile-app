# Courier app — complete endpoint reference

Every endpoint the ZBR courier app calls, with a real request and a real
response for each. Read alongside `COURIER_LIFECYCLE.md`, which explains the
order they go in and why; this file is the lookup table.

Read from the controllers and DTOs, not from memory. Where a field or a status
is surprising, the reason is stated rather than left for you to discover.

**Base URL:** `https://zbrr.uz/api/v1` — staging `https://staging.zbrr.uz/api/v1`

**Every response is wrapped**, except the two noted as exceptions:

```json
{ "success": true, "message": "…", "data": { }, "timestamp": "2026-09-04T11:20:07Z" }
```

Read `.data`. Absent fields are omitted entirely (`non_null` serialization), so
type them optional. Timestamps are UTC with a trailing `Z` and **no**
fractional seconds.

Send `Authorization: Bearer <accessToken>` on everything below except the four
auth endpoints marked *public*.

---

## 1. Authentication

### `POST /auth/phone/request-otp` — *public*

```json
{ "phone": "998901234567" }
```
```json
{ "success": true,
  "data": { "phone": "9989****67",
            "message": "Verification code sent to your phone",
            "expiresInSeconds": 300,
            "isNewUser": true,
            "remainingAttempts": 3 } }
```

`+998901234567`, `998901234567` and `901234567` are all accepted and normalise
to the same account. Drive the resend countdown from `expiresInSeconds`; do not
hardcode 300. Branch on `isNewUser`.

### `POST /auth/phone/verify-otp` — *public*, existing users

```json
{ "phone": "998901234567", "code": "483920" }
```
```json
{ "success": true,
  "data": { "accessToken": "eyJhbGciOi…",
            "refreshToken": "eyJhbGciOi…",
            "tokenType": "Bearer",
            "expiresIn": 3600000,
            "user": { "id": 42, "phone": "998901234567",
                      "fullName": "Asad Karimov", "role": "CONSUMER",
                      "status": "ACTIVE", "phoneVerified": true } }}
```

`user.role` reads `CONSUMER` **even for a fully registered courier** — the
COURIER role lives in a separate collection and is not reflected in this field.
Never decide the courier's state from it; use `GET /couriers/me`.

`expiresIn` is **milliseconds here** and **seconds** on `/auth/refresh`. Do not
compute expiry from either; refresh reactively on 401.

### `POST /auth/phone/complete-registration` — *public*, new users

Use the **same** code from `request-otp`. Do not request a second one.

```json
{ "phone": "998901234567", "otp": "483920",
  "fullName": "Asad Karimov", "email": "asad@example.com" }
```

`email` is optional. Response is identical to `verify-otp`.

### `POST /auth/phone/resend-otp` — *public*

```json
{ "phone": "998901234567" }
```
Same response as `request-otp`. Invalidates the previous code.

### `POST /auth/refresh` — *public*

```json
{ "refreshToken": "eyJhbGciOi…" }
```
```json
{ "success": true,
  "data": { "accessToken": "eyJhbGciOi…",
            "refreshToken": "eyJhbGciOi…",
            "tokenType": "Bearer",
            "expiresIn": 3600,
            "userId": 42, "email": null, "fullName": "Asad Karimov" } }
```

The **same** refresh token comes back — it is not rotated. `expiresIn` is in
**seconds** here. Single-flight this: concurrent 401s must trigger one refresh,
not one each.

### `POST /auth/logout`

```json
{ "refreshToken": "eyJhbGciOi…" }
```
```json
{ "success": true, "message": "Logout successful" }
```

Call `DELETE /device-tokens` first, or the phone keeps receiving push.

---

## 2. Becoming a courier

### `POST /couriers/register`

Requires a **consumer** token from phone OTP. This is the call that creates the
courier profile; without it the account is an ordinary customer.

```json
{ "vehicleType": "MOTORCYCLE",
  "vehicleNumber": "01A123BC",
  "licenseNumber": "AB1234567",
  "preferredRadiusKm": 5 }
```
```json
{ "success": true, "message": "Courier registration submitted",
  "data": { "id": 9, "userId": 42,
            "userName": "Asad Karimov", "phone": "998901234567", "email": null,
            "status": "PENDING_APPROVAL",
            "vehicleType": "MOTORCYCLE", "vehicleNumber": "01A123BC",
            "currentLat": null, "currentLng": null,
            "totalDeliveries": 0, "averageRating": 0,
            "verified": false, "currentOrderCount": 0 } }
```

**201.** Only `vehicleType` is required: `WALKING`, `BICYCLE`, `E_BIKE`,
`MOTORCYCLE`, `CAR`. `preferredRadiusKm` defaults to 5.

Keep `data.id` — that is the **courier profile id**, different from `userId`,
and it is what the WebSocket location topic and every admin endpoint use.

| Failure | Meaning |
|---|---|
| `400` `Courier already exists with userId : '42'` | Already registered. Treat as success and continue. |
| `403` | The token is not a consumer's (e.g. an admin token). |
| `401` | Token missing or expired. |

---

## 3. Courier profile

### `GET /couriers/me`

```json
{ "success": true,
  "data": { "id": 9, "userId": 42,
            "userName": "Asad Karimov",
            "phone": "998901234567", "email": null,
            "status": "AVAILABLE",
            "vehicleType": "MOTORCYCLE", "vehicleNumber": "01A123BC",
            "currentLat": 41.3110810, "currentLng": 69.2405620,
            "totalDeliveries": 217, "averageRating": 4.80,
            "verified": true, "currentOrderCount": 1 } }
```

**This is the source of truth for onboarding state.** `403` means no courier
profile exists — send the user to registration, not to an error screen.

### `PUT /couriers/me`

Edits an existing profile; it cannot create one. Vehicle details for a *new*
courier go in `POST /couriers/register`.

```json
{ "vehicleType": "CAR", "vehicleNumber": "01B456CD",
  "licenseNumber": "AB1234567", "preferredRadiusKm": 7,
  "maxConcurrentOrders": 2 }
```

Returns the updated `CourierDto`. It does **not** change name, phone or avatar —
those are `PUT /users/me`.

### `PUT /couriers/me/status`

```json
{ "status": "AVAILABLE" }
```
```json
{ "success": true, "message": "Status updated",
  "data": { "id": 9, "status": "AVAILABLE", "verified": true, "…": "…" } }
```

Values: `OFFLINE`, `AVAILABLE`, `BUSY`, `ON_BREAK`, `SUSPENDED`. Offer only the
first, second and fourth — `BUSY` is set by the backend at the concurrent-order
limit and `SUSPENDED` by an admin. Leaving `SUSPENDED` or `PENDING_APPROVAL` by
this call is rejected.

A `PATCH /couriers/me/status?status=AVAILABLE` variant exists and takes the
value as a **query parameter**. Use the `PUT`.

### `PUT /couriers/me/location`

```json
{ "latitude": 41.311081, "longitude": 69.240562 }
```
```json
{ "success": true, "message": "Location updated" }
```

No `data`. Send only while `AVAILABLE` or on an active order; throttle to one
per 10–15s and skip when the device has not moved ~20m.

A `POST /couriers/me/location?lat=…&lng=…` variant exists and uses **different
field names** (`lat`/`lng`). Use the `PUT`.

---

## 4. Finding work

### `GET /couriers/me/available-orders`

```json
{ "success": true,
  "data": [
    { "orderId": 77, "externalOrderNo": "ORD-2026-000077",
      "restaurantId": 3, "restaurantName": "Osh Markazi",
      "restaurantAddress": "Amir Temur 1, Toshkent",
      "restaurantPhone": "998712001122",
      "restaurantLat": 41.3110810, "restaurantLng": 69.2405620,
      "deliveryAddress": "Mustaqillik 15, kv 42",
      "deliveryLat": 41.3200000, "deliveryLng": 69.2500000,
      "customerName": "Dilnoza Rahimova", "customerPhone": "998907654321",
      "deliveryInstructions": "Ring twice",
      "status": "READY",
      "deliveryFee": 15000, "tipAmount": 0, "total": 85000, "itemCount": 3,
      "createdAt": "2026-09-04T10:02:11Z", "readyAt": "2026-09-04T10:19:40Z",
      "pickedUpAt": null, "deliveredAt": null } ] }
```

Returns unassigned `DELIVERY` orders a restaurant has already accepted, **oldest
first**.

**Not filtered by distance** — every courier sees every open order regardless of
`preferredRadiusKm`. Compute distance from the coordinates yourself; do not
label the list "near you".

`400` `Courier must be verified to see available orders` until an admin
approves. That is the approval gate, not a failure — show the waiting screen.

Two phone numbers, and they are different: `restaurantPhone` is the kitchen,
`customerPhone` is the recipient.

### `GET /couriers/me/orders/active`

Same element shape, filtered to `READY`, `COURIER_ASSIGNED`, `PICKED_UP`,
`IN_TRANSIT` for this courier. Plain array in `data`.

### `GET /couriers/me/orders/history?page=0&size=20`

```json
{ "success": true,
  "data": { "content": [ { "orderId": 77, "status": "DELIVERED", "…": "…" } ],
            "page": 0, "size": 20, "totalElements": 217, "totalPages": 11,
            "first": true, "last": false, "empty": false } }
```

### `GET /couriers/me/orders/{orderId}`

One `CourierOrderDto`, same shape as a list element. `400` if the order is not
assigned to this courier.

---

## 5. Delivering

All four take no body. Each returns the updated `CourierOrderDto`.

### `POST /couriers/me/orders/{orderId}/accept` → `COURIER_ASSIGNED`

```json
{ "success": true, "message": "Order accepted",
  "data": { "orderId": 77, "status": "COURIER_ASSIGNED", "…": "…" } }
```

| `400` message | Meaning |
|---|---|
| `Order already has a courier assigned` | Someone was faster. Normal — drop it from the list and refresh, no error dialog. |
| `Courier is not available to accept orders` | Offline, unverified, or at `maxConcurrentOrders`. |
| `Order must be accepted by restaurant before courier assignment` | The restaurant has not accepted it yet. |

### `PUT /couriers/me/orders/{orderId}/pickup` → `PICKED_UP`

`400` `Order is not ready for pickup yet. Wait for the restaurant to prepare
it.` when `readyAt` is still null. Keep the courier on the order screen with
`restaurantPhone` as a tap-to-call; do not send them back to the list.

### `PUT /couriers/me/orders/{orderId}/transit` → `IN_TRANSIT`

`400` `Order must be picked up before starting transit`.

### `POST /couriers/me/orders/{orderId}/complete` → `DELIVERED`

Settles the order: confirms cash payment (card orders untouched), records
platform commission, and credits `deliveryFee + tipAmount` to the courier.

### `POST /couriers/me/orders/{orderId}/issue`

```json
{ "issueType": "CUSTOMER_UNAVAILABLE", "description": "No answer at the door after 5 minutes" }
```
```json
{ "success": true, "message": "Issue reported" }
```

`issueType`: `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `RESTAURANT_DELAY`,
`ACCIDENT`, `VEHICLE_ISSUE`, `OTHER`. No `data` in the response.

### `POST /couriers/me/orders/{orderId}/rating`

The courier rating the delivery, after it is delivered.

```json
{ "rating": 5, "comment": "Easy drop-off" }
```
```json
{ "success": true, "message": "Rating submitted" }
```

`rating` is required, 1–5. `comment` optional.

---

## 6. Earnings and reviews

### `GET /couriers/me/earnings`

```json
{ "success": true,
  "data": { "todayEarnings": 145000, "weekEarnings": 890000,
            "monthEarnings": 3450000, "totalEarnings": 12800000,
            "todayDeliveries": 9, "weekDeliveries": 54,
            "monthDeliveries": 211, "totalDeliveries": 780,
            "averagePerDelivery": 16410,
            "pendingPayout": 145000,
            "cashEarnings": 620000, "cardEarnings": 270000,
            "withdrawableBalance": 890000 } }
```

All UZS as plain decimals — `15000` means 15 000 so'm, not 150.00.

### `GET /couriers/me/reviews?page=0&size=20`

```json
{ "success": true,
  "data": { "content": [
      { "id": 5, "orderId": 77, "consumerId": 42, "consumerName": "Dilnoza R.",
        "restaurantId": 3, "courierId": 9,
        "restaurantRating": 5, "courierRating": 5, "foodRating": 4,
        "comment": "Fast delivery", "tags": ["polite", "on time"],
        "createdAt": "2026-09-04T12:40:03Z" } ],
      "page": 0, "size": 20, "totalElements": 31, "totalPages": 2,
      "first": true, "last": false, "empty": false } }
```

Reviews cover the restaurant and the food too; show `courierRating` and
`comment`, not `restaurantRating`.

---

## 7. Identity — a different endpoint

The courier's **name, phone and avatar** are not on the courier profile.

### `GET /users/me`

```json
{ "success": true,
  "data": { "id": 42, "phone": "998901234567", "email": null,
            "firstName": "Asad", "lastName": "Karimov", "fullName": "Asad Karimov",
            "profileImageUrl": "https://zbrr.uz/api/v1/images/profiles/42/a.jpg",
            "roles": ["COURIER"], "status": "ACTIVE",
            "phoneVerified": true, "emailVerified": false,
            "lastLoginAt": "2026-09-04T06:12:00Z",
            "lastSeenAt": "2026-09-04T11:19:55Z",
            "createdAt": "2026-03-14T08:11:02Z" } }
```

### `PUT /users/me`

```json
{ "firstName": "Asad", "lastName": "Karimov",
  "phone": "998901234567",
  "profileImageUrl": "https://…" }
```

Only these four fields. Changing `phone` sets `phoneVerified` to false.

The profile screen reads `/users/me` **and** `/couriers/me` — fetch in parallel
and merge.

---

## 8. Push notifications

### `POST /device-tokens`

```json
{ "token": "fcm-registration-token…",
  "platform": "ANDROID",
  "deviceId": "a1b2c3d4",
  "deviceName": "Redmi Note 12",
  "appId": "app.zbr.courier",
  "appVersion": "1.0.3" }
```
```json
{ "success": true, "message": "Device token registered successfully", "tokenId": 14 }
```

**Exception: no envelope.** Read the top level, do not unwrap `.data`.

`platform`: `ANDROID`, `IOS`, `WEB`, `UNKNOWN`. `appId` must be the real bundle
id — on iOS it becomes the `apns-topic` and APNs rejects anything else. Call
this after every login and whenever FCM rotates the token.

### `DELETE /device-tokens`

```json
{ "deviceToken": "fcm-registration-token…" }
```

**Note the field name.** Registering uses `token`; removing uses
`deviceToken`. That asymmetry is real and easy to miss — sending `token` here
is a silent no-op and the phone keeps receiving push after logout.

Also no envelope. Call it on logout, before `POST /auth/logout`.

Android: create the notification channel **`orders_v2`** with
`IMPORTANCE_HIGH` at app start — the backend sends that channel id, and a
mismatched or low-importance channel means no heads-up alert.

---

## 9. In-app notifications

### `GET /notifications/me?page=0&size=20&isRead=false`

**Exception: no envelope.** Returns `NotificationListDto` at the top level.

Optional filters: `role`, `isRead`, `category`.

### `GET /notifications/unread/count`

```json
{ "unreadCount": 3 }
```

Top level, no envelope. Use it for the badge.

### `PATCH /notifications/{id}/read`

Marks one read. The backend enforces ownership — a courier can only touch their
own notifications.

---

## Quick index

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/phone/request-otp` | send code |
| POST | `/auth/phone/verify-otp` | log in, existing user |
| POST | `/auth/phone/complete-registration` | log in, new user |
| POST | `/auth/phone/resend-otp` | resend code |
| POST | `/auth/refresh` | new access token |
| POST | `/auth/logout` | revoke refresh token |
| POST | `/couriers/register` | **create the courier profile** |
| GET | `/couriers/me` | profile + onboarding state |
| PUT | `/couriers/me` | edit vehicle details |
| PUT | `/couriers/me/status` | go online / offline / on break |
| PUT | `/couriers/me/location` | position update |
| GET | `/couriers/me/available-orders` | open orders |
| GET | `/couriers/me/orders/active` | in-flight orders |
| GET | `/couriers/me/orders/history` | past orders, paged |
| GET | `/couriers/me/orders/{id}` | one order |
| POST | `/couriers/me/orders/{id}/accept` | take the order |
| PUT | `/couriers/me/orders/{id}/pickup` | collected from kitchen |
| PUT | `/couriers/me/orders/{id}/transit` | on the way |
| POST | `/couriers/me/orders/{id}/complete` | delivered |
| POST | `/couriers/me/orders/{id}/issue` | report a problem |
| POST | `/couriers/me/orders/{id}/rating` | rate the delivery |
| GET | `/couriers/me/earnings` | money |
| GET | `/couriers/me/reviews` | ratings received, paged |
| GET | `/users/me` | name, phone, avatar |
| PUT | `/users/me` | edit those |
| POST | `/device-tokens` | register for push |
| DELETE | `/device-tokens` | deregister on logout |
| GET | `/notifications/me` | in-app notifications |
| GET | `/notifications/unread/count` | badge count |
| PATCH | `/notifications/{id}/read` | mark read |

Anything not on this list is not for the courier app. `/couriers/{courierId}/…`
routes — verify, reject, suspend, activate, the courier list — are admin-only
and will return 403.

# Courier lifecycle — API flow

Two audiences: the flow itself, then a prompt to hand the courier app team.

Everything here was read from `CourierController`, `CourierService`,
`OrderRepository` and `WebSocketDestinationAuthorizer`, not described from
memory. Where a call fails for a non-obvious reason, that reason is named.

---

## Part 1 — the flow, end to end

### A. Registration (once per courier)

```
                                       creates a CONSUMER, no courier profile
 1. POST /auth/phone/request-otp   ──┐
 2. POST /auth/phone/verify-otp      ├──► users row
    (or /complete-registration)    ──┘

 3. POST /couriers/register           ──► couriers row, status PENDING_APPROVAL
                                          verified = false, ROLE_COURIER granted

 4. POST /couriers/{courierId}/verify ──► verified = true, status OFFLINE
    (admin)                               courier can now work
```

**Step 3 is a separate call the app must make.** OTP signup alone produces a
plain consumer — the backend cannot tell which app the OTP came from.

Until `245e687` this step was impossible: the URL rule
`/api/v1/couriers/**` required `ROLE_COURIER`, and `/couriers/register` is the
endpoint that GRANTS that role, so it answered 403 to exactly the users meant to
call it. That was a backend bug, not an app one, and it is why the platform had
courier users and no courier profiles.

```
POST /api/v1/couriers/register        requires ROLE_CONSUMER
{ "vehicleType": "MOTORCYCLE", "vehicleNumber": "01A123BC",
  "licenseNumber": "AB1234567", "preferredRadiusKm": 5 }
```

Only `vehicleType` is required — `WALKING`, `BICYCLE`, `E_BIKE`, `MOTORCYCLE`,
`CAR`. The profile lands in `PENDING_APPROVAL` with `verified = false`.

**The caller must be a phone-OTP consumer.** `hasRole('CONSUMER')` is enforced
at the method level, so an ADMIN or PLATFORM token gets 403 here — an operator
cannot register a courier on someone's behalf, and there is currently no
admin-side endpoint that does. The only route in is the courier signing
themselves up from the app.

**Step 4 is a human decision.** An admin calls
`POST /couriers/{courierId}/verify`, which sets `verified = true` and moves the
status to `OFFLINE` — ready to work, not yet online. `POST /couriers/{id}/reject`
takes the other branch and suspends them. Pending couriers are listed at
`GET /couriers/pending`.

Note `{courierId}` here is the **courier profile id**, not the user id. They are
different numbers.

### B. Going to work (every shift)

```
 5. PUT /couriers/me/status  { "status": "AVAILABLE" }
 6. GET /couriers/me/available-orders
 7. PUT /couriers/me/location  { "latitude": …, "longitude": … }   (repeating)
```

`GET /couriers/me/available-orders` returns **400** with *"Courier must be
verified to see available orders"* until step 4 has happened. That is the single
most likely thing to look like a broken app, so handle it explicitly.

An order appears in that list when **all** of these hold:

- restaurant has accepted it — status is `ACCEPTED`, `PREPARING` or `READY`
- `orderType` is `DELIVERY` (takeaway and dine-in never appear)
- no courier is assigned yet

Oldest first. It is **not** filtered by distance — `preferredRadiusKm` is stored
but not applied to this query, so every courier sees every unassigned order.

### C. Delivering one order

```
 8. POST /couriers/me/orders/{id}/accept   ──► COURIER_ASSIGNED
 9. PUT  /couriers/me/orders/{id}/pickup   ──► PICKED_UP
10. PUT  /couriers/me/orders/{id}/transit  ──► IN_TRANSIT
11. POST /couriers/me/orders/{id}/complete ──► DELIVERED
```

Each step has a precondition that returns **400** with a readable message:

| Step | Refuses when | Message |
|---|---|---|
| accept | courier is not `AVAILABLE`, not verified, or already at `maxConcurrentOrders` | `Courier is not available to accept orders` |
| accept | someone else took it first | `Order already has a courier assigned` |
| pickup | the restaurant has not finished cooking (`readyAt` is null) | `Order is not ready for pickup yet. Wait for the restaurant to prepare it.` |
| transit | not picked up yet | `Order must be picked up before starting transit` |
| any | the order belongs to another courier | `This order is not assigned to you` |

`accept` is genuinely racy — two couriers can tap the same order and one loses.
That is normal, not an error condition.

On `complete` the backend settles the order: cash payment is confirmed (card
orders are left alone), platform commission is recorded, and the courier's
earnings go up by `deliveryFee + tipAmount`.

Each order in these lists carries both `restaurantPhone` and `customerPhone`,
plus `restaurantLat/Lng` and `deliveryLat/Lng`. `restaurantPhone` was added for
the not-ready-yet case above; it is the kitchen, not the customer.

### D. Everything else

**Every endpoint below requires `ROLE_COURIER`**, which only step 3 grants. A
consumer calling any of them gets 403 — correctly. In particular there is no
"add a vehicle" endpoint to call before registering: `PUT /couriers/me` EDITS an
existing courier profile and cannot create one. Vehicle details go INSIDE the
registration call.

```
GET /couriers/me                       profile: status, vehicle, rating, verified
PUT /couriers/me                       vehicle details only — courier must exist
GET /users/me                          name, phone, avatar — a DIFFERENT endpoint
GET /couriers/me/orders/active         in-flight orders
GET /couriers/me/orders/history        paged
GET /couriers/me/earnings              today / week / month / total, cash vs card
GET /couriers/me/reviews               paged
POST /couriers/me/orders/{id}/issue    report a problem
POST /device-tokens                    register for push
```

---

## Part 2 — prompt for the courier app team

Paste everything below the line.

---

> You are building the ZBR **courier** app in React Native (Expo). The backend
> is live at `https://zbrr.uz/api/v1` and none of it needs changing — this is
> app-side work.
>
> Read `docs/FRONTEND_PROFILE_INTEGRATION.md` first for the shared contract:
> response envelope, token refresh, timestamps, error handling. This document
> only covers the courier lifecycle.
>
> ## The one thing to change
>
> **Your signup flow is missing an API call.** Everything else in this document
> describes an app that has already made it.
>
> There is no "sign up as a courier" endpoint, and there will not be one. OTP
> signup is shared by all three apps — the backend cannot tell which app a code
> came from, so it creates a plain **consumer** every time. A courier is that
> consumer account **plus** a courier profile, and the profile is created by a
> second call your app must make:
>
> ```
> POST /api/v1/couriers/register
> Authorization: Bearer <the token you just got from verify-otp>
>
> { "vehicleType": "MOTORCYCLE" }
> ```
>
> ### Does your app have this bug?
>
> Sign up a fresh phone number, then call `GET /api/v1/couriers/me` with that
> token.
>
> - **403** → the call above is missing. The user is a customer, not a courier.
>   This is the bug.
> - **200** → your app already registers correctly.
>
> ### The sequence, in full
>
> ```ts
> // 1. OTP — identical to the customer app
> await api.post('/auth/phone/request-otp', { phone });
>
> const { data } = await api.post('/auth/phone/verify-otp', { phone, code });
> //   ...or /auth/phone/complete-registration for a new user, with the SAME
> //   code plus fullName. Do NOT request a second OTP.
> await saveTokens(data.accessToken, data.refreshToken);
>
> // 2. THE MISSING CALL. Without it the account is an ordinary customer.
> await api.post('/couriers/register', {
>   vehicleType,          // required — collected in onboarding
>   vehicleNumber,        // optional
>   licenseNumber,        // optional
>   preferredRadiusKm: 5, // optional
> });
> ```
>
> Make it part of the same onboarding flow, not a later screen. If it fails, the
> user is **not** a courier — do not let them into the app; show the error and a
> retry. Landing a half-registered user on the order list is how this went
> unnoticed for weeks.
>
> `vehicleType` is required and must be one of `WALKING`, `BICYCLE`, `E_BIKE`,
> `MOTORCYCLE`, `CAR`. There is no default; collect it before you call.
>
> You do **not** need to refresh the token afterwards. The backend re-reads roles
> from the database on every request, so `ROLE_COURIER` applies on the next call.
>
> ### What the response means
>
> | Status | Meaning | Do |
> |---|---|---|
> | `201` | Profile created, `PENDING_APPROVAL` | Go to the waiting-for-approval screen |
> | `400` `Courier already exists...` | Already registered | Treat as success, continue |
> | `403` | Token is not a consumer's — e.g. an admin token | Re-authenticate by phone OTP |
> | `401` | Token missing or expired | Refresh, retry once |
>
> ### Which screen to show
>
> After login, `GET /couriers/me` decides everything. Drive onboarding from the
> backend's state, never from a local "did I register?" flag — reinstalls and
> second devices make local flags lie.
>
> | `GET /couriers/me` | State | Screen |
> |---|---|---|
> | `403` | No courier profile | Onboarding — collect vehicle, call `/couriers/register` |
> | `200`, `verified: false`, `PENDING_APPROVAL` | Awaiting admin | Waiting for approval |
> | `200`, `verified: false`, `SUSPENDED` | Rejected | Contact support — no retry |
> | `200`, `verified: true` | Ready | The app proper |
>
> ### Historical note
>
> Until early September this call returned 403 to everyone, because of a backend
> authorization bug (the URL rule required the very role that registering
> grants). If you implemented it, saw 403, and removed it — the code was right
> and the backend was not. It is fixed. Put the call back and re-test.
>
> ## The approval gate — build a real screen for this
>
> A new courier is `PENDING_APPROVAL` with `verified: false`. An admin must
> approve them. Until then **`GET /couriers/me/available-orders` returns 400**
> with `"Courier must be verified to see available orders"`.
>
> Do not show that as an error toast. Build an explicit "waiting for approval"
> screen showing what was submitted, and poll `GET /couriers/me` **on app focus**
> — not on a timer, and not in the background. When `verified` becomes `true` and
> status is `OFFLINE`, move them into the app.
>
> If an admin rejects them, status becomes `SUSPENDED` and `verified` stays
> false. Show a "contact support" state, not a retry button — re-registering
> will fail because one user can only have one courier profile.
>
> ## Going online
>
> ```
> PUT /couriers/me/status   { "status": "AVAILABLE" }
> ```
>
> Statuses: `OFFLINE`, `AVAILABLE`, `BUSY`, `ON_BREAK`, `SUSPENDED`.
>
> Only `OFFLINE`, `AVAILABLE` and `ON_BREAK` belong in the picker. `BUSY` is set
> by the backend when the courier reaches their concurrent-order limit, and
> `SUSPENDED` is set by an admin — render both as read-only states with an
> explanation. The backend rejects self-service attempts to leave `SUSPENDED` or
> `PENDING_APPROVAL`.
>
> A `PATCH /couriers/me/status?status=…` variant also exists, taking the value as
> a query parameter. **Use the `PUT` with a JSON body** and be consistent.
>
> ## The order list
>
> ```
> GET /couriers/me/available-orders
> ```
>
> Returns unassigned `DELIVERY` orders the restaurant has already accepted,
> oldest first. Two things to design around:
>
> 1. **It is not filtered by distance.** Every courier sees every open order,
>    regardless of `preferredRadiusKm`. Each entry carries `restaurantLat/Lng`
>    and `deliveryLat/Lng` — compute and show the distance yourself, and sort or
>    filter locally if that helps couriers choose. Do not tell the user the list
>    is "near you".
> 2. **It is a poll, not a stream.** Refresh on pull-to-refresh and on app focus.
>    A 15–30s interval while the app is foregrounded and the courier is
>    `AVAILABLE` is reasonable; stop polling when they are offline or
>    backgrounded.
>
> ## Delivering
>
> Four calls, strictly in order:
>
> ```
> POST /couriers/me/orders/{id}/accept     → COURIER_ASSIGNED
> PUT  /couriers/me/orders/{id}/pickup     → PICKED_UP
> PUT  /couriers/me/orders/{id}/transit    → IN_TRANSIT
> POST /couriers/me/orders/{id}/complete   → DELIVERED
> ```
>
> Drive the UI from the order's `status` field, never from local state — the
> courier may have acted on another device, or the restaurant may have cancelled.
> Re-fetch the order after every transition and render the next available action
> from the status you get back.
>
> Three failures you must handle as normal outcomes, not crashes:
>
> - **`Order already has a courier assigned`** — someone was faster. Show
>   "this order was just taken", drop it from the list, refresh. No error dialog.
> - **`Order is not ready for pickup yet. Wait for the restaurant to prepare
>   it.`** — the courier arrived before the food is ready. Keep them on the order
>   screen and let them retry; do not send them back to the list. Show
>   `restaurantPhone` from the order payload as a tap-to-call — that is the
>   kitchen's number, distinct from `customerPhone`, and it is the one that is
>   useful here.
> - **`Courier is not available to accept orders`** — they went offline, were
>   suspended, or are at their concurrent-order limit. Check `GET /couriers/me`
>   and show which of those it is.
>
> Surface the backend's `message` directly. It is written for end users.
>
> ## Location
>
> ```
> PUT /couriers/me/location   { "latitude": 41.311081, "longitude": 69.240562 }
> ```
>
> Send only while the courier is `AVAILABLE` or has an active order. Throttle to
> one update per 10–15 seconds and skip when the device has not moved ~20m. This
> runs on their battery and their data; a courier whose phone dies mid-shift
> cannot deliver.
>
> Stop entirely when they go `OFFLINE`.
>
> A `POST /couriers/me/location?lat=…&lng=…` variant exists and uses **different
> field names**. Use the `PUT` with the JSON body.
>
> ## Push notifications
>
> Register the device token after login and whenever FCM rotates it:
>
> ```
> POST /device-tokens
> { "token": "<fcm token>", "platform": "ANDROID", "deviceId": "...",
>   "deviceName": "Redmi Note 12", "appId": "app.zbr.courier", "appVersion": "1.0.3" }
> ```
>
> `appId` must be your **real** bundle/application id. The backend does not use
> it to decide who receives a push, but on iOS it becomes the `apns-topic`
> header, and APNs rejects a push whose topic is not the app's own bundle id.
> Send the true value even while you are Android-only, so iOS works the day it
> ships.
>
> **This endpoint does NOT use the standard response envelope** — it returns
> `{ success, message, tokenId }` at the top level. Do not unwrap `.data`.
>
> `DELETE /device-tokens` on logout.
>
> Android delivery depends on the notification channel matching what the backend
> sends: **`orders_v2`**. Create that channel at app start with
> `IMPORTANCE_HIGH`. Channel importance is fixed at creation, so if you have
> already shipped a channel with lower importance you must use a new channel name
> and tell us to update the backend config to match. Also prompt couriers to
> exempt the app from battery optimisation — Xiaomi, Huawei, Oppo and Realme all
> delay high-priority push otherwise, which for a courier app means missed orders.
>
> ## Live updates (optional, after the above works)
>
> STOMP over `wss://zbrr.uz/ws`, with `Authorization: Bearer <accessToken>` as a
> CONNECT header. A courier may subscribe to:
>
> - `/topic/orders/{orderId}` — orders they are a party to
> - `/topic/orders/{orderId}/taken` — any authenticated user; use it to remove an
>   order from the available list the moment someone else accepts it
> - `/topic/couriers/{courierId}/location` — their own only, keyed by **courier
>   profile id**, not user id
> - `/topic/users/{userId}/notifications` — their own
>
> Subscribing to anything else is rejected. Authentication happens only at
> CONNECT: when the access token expires the socket does not re-authenticate, so
> refresh first and reconnect.
>
> ## Two profiles, not one
>
> The courier's identity and their work data live in different places:
>
> | | Endpoint | Holds |
> |---|---|---|
> | Identity | `GET`/`PUT /users/me` | name, phone, avatar |
> | Work | `GET`/`PUT /couriers/me` | status, vehicle, rating, verified, deliveries |
>
> The profile screen reads both — fetch in parallel and merge. `PUT
> /couriers/me` accepts only `vehicleType`, `vehicleNumber`, `licenseNumber`,
> `preferredRadiusKm`, `maxConcurrentOrders`; it will not change their name.
>
> `PUT /couriers/me` requires `ROLE_COURIER`, so it only works AFTER
> registration. It edits a courier profile, it cannot create one — there is no
> separate "add vehicle" step. If onboarding collects the vehicle on its own
> screen, hold the value and send it in the `POST /couriers/register` body; a
> 403 here means the profile does not exist yet.
>
> Note `GET /couriers/me` returns both `id` (courier profile id) and `userId`.
> The WebSocket location topic and all admin endpoints use `id`; `/users/me` is
> about `userId`. Confusing them is the most common mistake here.
>
> ## Definition of done
>
> Prove each one; do not infer it from the UI looking right.
>
> 1. A brand-new phone number signs up in the app and then
>    `GET /couriers/me` returns **200**, not 403. This is the acceptance test for
>    the whole change — if it still 403s, nothing else here matters.
> 2. That courier appears in `GET /couriers/pending` for an admin.
> 3. Before approval the app shows the waiting screen, not an error toast.
> 4. After the admin approves, the courier goes online and sees the order list.
> 5. One full delivery through all four transitions.
> 6. Losing an accept race, and arriving before the food is ready, both show
>    sensible messages and leave the app usable.
> 7. Push arrives on a physical Android device with the app backgrounded.
>
> Ask the backend team to confirm from the server side — they can see whether
> `POST /couriers/register` was received at all, which settles any disagreement
> about whether the app sent it.
>
> Test against **`https://staging.zbrr.uz/api/v1`**, not production. Staging
> sends no SMS: log in with `+998900000000` and OTP code `123456`. Access tokens
> there expire after 60 seconds on purpose, so token refresh is exercised
> constantly — if refresh is broken you will find out in two minutes.

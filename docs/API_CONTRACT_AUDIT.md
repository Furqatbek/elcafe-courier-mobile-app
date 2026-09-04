# API contract audit

Every point in `COURIER_LIFECYCLE.md` and `COURIER_API_REFERENCE.md` checked
against the code, with the outcome. Written so the next person can tell what was
actually verified from what was merely made to look right.

Nothing here was tested against a live backend — there is no device or network
access in the environment this was done in. "Fixed" means the code now matches
the reference; it does not mean a real request was observed.

---

## 1. Fixed — the app disagreed with the API

| # | Contract | Was | Consequence |
|---|---|---|---|
| 1 | New users finish through `POST /auth/phone/complete-registration` | Always called `verify-otp` | **A brand-new phone number could not sign up.** `verify-otp` is for existing accounts; `isNewUser` from `request-otp` was never read, and no name was collected. This is acceptance test #1 in the lifecycle doc. |
| 2 | `GET /couriers/me` `403` → send to registration | `courierProfile` null was read as "verified" | A restored session with no courier profile fell **into the app** and then failed on every courier endpoint. Now `hasCourierProfile === false` routes to `become-courier`. |
| 3 | `GET /couriers/me/available-orders` `400` "must be verified" is the approval gate | Not checked; fell through as an empty list | An unapproved courier saw "no open orders" — indistinguishable from a quiet day — and waited instead of chasing approval. |
| 4 | `DELETE /device-tokens` takes `{ deviceToken }` | Sent **no body at all** | Logout did not deregister the device. **The phone kept receiving order push after signing out.** |
| 5 | Identity is `GET /users/me` | `refreshUser()` used `/auth/me`, which is not in the reference | Fixed the same day it was written — the endpoint was a guess before these docs arrived. |
| 6 | `verify-otp` field is `code` | Sent `otp` | See "Deliberately not resolved" below. |
| 7 | `resend-otp` exists and invalidates the previous code | Resend called `request-otp` | |
| 8 | Countdown from `expiresInSeconds` | Hardcoded `APP_CONFIG.OTP_RESEND_DELAY` | App and server could disagree about when a code was dead. |
| 9 | `PUT /couriers/me` accepts 5 vehicle fields | Type also declared `firstName/lastName/email/phone` and `vehicleBrand/vehicleModel` | The vehicle form **required** brand and model. The backend discarded both on every save. |
| 10 | `PUT /users/me` accepts 4 fields, not `email` | Sent `email` | The email field was editable and required; the value went nowhere. Now read-only with a note. |
| 11 | Review `tags` is an array | Typed `string`, called `.split(',')` | **`.split` on an array throws** — any review with tags crashed the screen. |
| 12 | `/notifications/me` pages with `size` | Sent `pageSize` | Unrecognised name → server default; a custom page size was ignored. |
| 13 | Available orders take no parameters and are not distance-filtered | Sent `lat`/`lng`/`radiusKm` | Implied a proximity filter that does not exist. Also removed the last "nearby" wording. |
| 14 | No auth endpoint returns a courier profile | `verifyOtp` read `data.data.courier` | Dead branch; the field is never present. |
| 15 | `POST /couriers/register`: only `vehicleType` required | Required licence **and** plate from everyone | Fixed in the previous change — `WALKING`/`BICYCLE`/`E_BIKE` couriers could not register at all. |
| 16 | Endpoints missing from the shared table | Reviews and rating hardcoded at call sites | Now in `API_ENDPOINTS`, locked by `lib/__tests__/api-contract.test.ts`. |

## 2. Already correct — verified, not assumed

- Order transitions and their verbs: `accept` POST, `pickup` PUT, `transit` PUT,
  `complete` POST, `issue` POST.
- `PUT /couriers/me/status` with a JSON body (not the `PATCH` query-param variant).
- `PUT /couriers/me/location` with `{ latitude, longitude }` (not the `POST`
  `lat`/`lng` variant).
- Location throttle: 12s minimum interval, 20m minimum distance, 120s heartbeat
  — inside the reference's 10–15s / ~20m guidance.
- `restaurantPhone` surfaced as tap-to-call on the order screen, distinct from
  `customerPhone`.
- Available-orders polling: 20s, foreground-only, gated on `AVAILABLE`.
- `verification-pending` polls `GET /couriers/me` **on app focus**, not on a
  timer, and renders `SUSPENDED` as contact-support with no retry.
- WebSocket subscriptions limited to the four permitted destinations, courier
  location keyed by **courier profile id** and notifications by **user id**.
- `orders_v2` notification channel at `IMPORTANCE_HIGH`.
- Timestamps parsed as UTC with a trailing `Z`.
- Device-token registration and the notification endpoints read at the top level
  (no `.data` envelope).
- `user.role` is never used to decide courier state.

## 3. Deliberately not resolved

**`verify-otp`: `code` vs `otp`.** The reference says the field is `code` on
`verify-otp` and `otp` on `complete-registration`. The app has always sent `otp`.
Switching outright would bet the entire login flow on the doc being right about
which name the DTO uses — and a backend doc in this project has been wrong
before (it described a timestamp format the parser had correct). The request now
sends **both**, so the documented name takes effect either way.

Remove the `otp` alias from `verifyOtp` once one real `verify-otp` call has been
observed to succeed. Same reasoning for `pageSize` alongside `size` on the
notifications list.

## 4. Needs a live backend — cannot be settled from the code

1. **Does a new phone number now complete signup?** The whole
   `complete-registration` path is written from the doc and has never run.
2. **`GET /couriers/me` after a fresh signup returns 200, not 403** — the
   lifecycle doc's own acceptance test.
3. Whether `verify-otp` accepts `code`, `otp`, or both.
4. Whether `DELETE /device-tokens` accepts the body now being sent.
5. Whether `PUT /couriers/me` rejects the now-removed fields or merely ignored
   them (behaviour is the same either way, but the doc's claim is untested).

Staging is the place for all five: `https://staging.zbrr.uz/api/v1`, phone
`+998900000000`, OTP `123456`, no SMS sent. Access tokens expire after 60
seconds there, which exercises refresh continuously.

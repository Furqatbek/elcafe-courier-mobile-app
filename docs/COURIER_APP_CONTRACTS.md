# Courier app contracts — answers

Reply to `BACKEND_QUESTIONS.md`. Every field below was read out of the code, not
remembered. Where the answer is "that field does not exist", it says so.

**One thing to know before the field lists.** Jackson is configured
`default-property-inclusion: non_null`, so **a null field is absent from the
JSON entirely** — not `null`, not `""`. Every "optional" below means the key is
missing when there is no value. Treat every field as possibly absent.

---

## 1. Status-change push — the data you want was being dropped

**It should have carried the status. It was built and then thrown away one call
before the push.**

`OrderEventConsumer.buildStatusChangeRequest` puts `previousStatus` and
`newStatus` into the request's `metadata` map. `createOrderNotification` then
copied only `getAdditionalData()` into the push — and **nothing in the codebase
ever sets `additionalData`**. Two maps on one DTO, every caller filling one and
the push reading the other. So `newStatus`, `previousStatus`, `reason`,
`paymentId`, `amount` and `failureReason` were all constructed and silently
discarded. Your refetch was the only way to learn anything.

Fixed. An order status-change push now carries:

| key | example | notes |
|---|---|---|
| `type` | `ORDER_READY` | the `NotificationType` name — see §2 |
| `notificationType` | `ORDER_READY` | same value, second key for the customer app |
| `orderId` | `"4417"` | bare digits |
| `newStatus` | `READY` | the `OrderStatus` name |
| `previousStatus` | `PREPARING` | |
| `reason` | `"Kitchen closed"` | only on a cancellation |
| `orderNumber` | `"ZBR-000412"` | |
| `restaurantName` | `"Qahvoon"` | |
| `courierName` | `"Aziz"` | absent when unassigned |
| `cancellationReason` | | only when set |
| `category` | `ORDER` | `NotificationCategory` name |
| `actionUrl` | `/orders/4417` | **new** — see §2 |
| `notificationId` | `"881"` | the notification row, not the order |
| `channel` | `push` | |

**Yes, every value is a string.** That is FCM's data payload, not a choice —
`Map<String, String>` is the only shape it accepts. `newStatus` is the enum
name, so compare against `OrderStatus` spellings, not lower case.

**So you can patch state from the push and skip the refetch**, with one caveat:
the push carries status and identity, not money. `deliveryFee`, `tipAmount` and
`total` are not in it and will not be. If a screen shows those, either take them
from the socket or keep one fetch when they are missing.

## 2. Notification `type` values sent to couriers

For every audience except the vendor app, `data.type` is **the `NotificationType`
enum name, exactly**. The complete set a courier can receive:

| `type` | When |
|---|---|
| `NEW_DELIVERY_AVAILABLE` | A delivery is offered — broadcast when no courier is assigned, **and** sent to the courier when they are assigned to one |
| `ORDER_READY` | An order already assigned to this courier is ready for pickup |
| `DELIVERY_COMPLETED` | Their delivery was marked delivered |
| `ORDER_CANCELLED` | An order they are carrying was cancelled |

**Your six constants against that list:**

| Yours | Verdict |
|---|---|
| `NEW_ORDER_NEARBY` | Never sent. You want `NEW_DELIVERY_AVAILABLE` |
| `ORDER_ASSIGNED` | Never sent. Assignment arrives as `NEW_DELIVERY_AVAILABLE` too — see below |
| `ORDER_CANCELLED` | Real |
| `PAYOUT_ISSUED` | Never sent. `PAYOUT_COMPLETED` exists as a type, but `PayoutIssuedEvent` **is never published by anything**, so no payout push exists at all |
| `VERIFICATION_APPROVED` | No such type. `ACCOUNT_VERIFIED` exists in the enum and is never sent either |
| `RATING_RECEIVED` | No such type, in the enum or anywhere |

**The one worth arguing about:** when a courier is assigned to an order, they
receive `NEW_DELIVERY_AVAILABLE` — the same type as an open broadcast to
everyone. The customer and the restaurant both get `COURIER_ASSIGNED` for the
same event; only the courier's own copy is overwritten. So the courier app
cannot tell "a job is going spare" from "this job is yours" by type alone, and
the two want different sounds. Tell us if you want a distinct type and we will
add one — it is a three-line change we did not make unilaterally because it
changes a string you branch on.

**`data.orderId`** — confirmed, bare digits as a string, present on every
order-related push.

**`data.actionUrl`** — the format is `/orders/{orderId}`, so your
`/orders/(\d+)` is right. **But it was never sent.** It was stored on the
notification row and dropped from the push, so your parse has been failing over
to `orderId` every time. Now sent.

## 3. `POST /couriers/me/orders/{id}/complete`

**Returns a `CourierOrderDto`, and there is no `earnings` field in it.** Your
"You earned 0" came from reading a key that has never existed. The local
fallback is currently the only correct source, so keep it.

```
data: { orderId, externalOrderNo, restaurantId, restaurantName, restaurantAddress,
        restaurantPhone, restaurantLat, restaurantLng, deliveryAddress, deliveryLat,
        deliveryLng, customerName, customerPhone, deliveryInstructions, status,
        deliveryFee, tipAmount, total, itemCount, createdAt, readyAt, pickedUpAt,
        deliveredAt }
```

The amount credited is `deliveryFee + tipAmount`, both present in that response,
so computing it locally gives the authoritative number rather than an
approximation. If you would rather have it named, say so and we will add
`earnings` to this response only — we would rather add it deliberately than have
you guess again.

**The endpoint takes no body.** The handler is `(currentUser, orderId)` and
nothing reads a request body. `deliveryPhoto` and `deliveryNotes` have never
been accepted — stop sending them.

## 4. `OrderDto` over the WebSocket

The socket sends the **full `OrderDto`** to `/topic/orders/{orderId}` (also to
`/topic/restaurants/{id}/orders` and the customer's `/user/queue/orders`).

| You read | Present? |
|---|---|
| `id` | Yes |
| `status` | Yes — `OrderStatus` name |
| `customerName` | Yes |
| `customerPhone` | Yes |
| `deliveryFee`, `tipAmount`, `total` | Yes |
| `readyAt`, `pickedUpAt`, `deliveredAt` | Yes |
| `restaurantPhone` | **No — it did not exist on `OrderDto`.** Added now |

`restaurantPhone` is on `CourierOrderDto` (the REST shape) and was never on
`OrderDto`, so reading it off the socket gave `undefined` — a courier could not
call the kitchen from a screen driven by the socket. It maps from the venue's
own `phone`.

**`id` vs `orderId` is intended, and it is not arbitrary:** `OrderDto` is the
order itself, so its primary key is `id`. `CourierOrderDto` is a courier's *view
of* an order, so the order's id is a named reference, `orderId`. Same number,
two shapes. We are not renaming either — shipped clients read both — but it is
worth a comment in your types so the next person does not think one is a typo.

Also on `OrderDto` and useful to you: `externalOrderNo`, `restaurantName`,
`courierName`, `courierPhone`, `orderType`, `paymentStatus`, `items[]`,
`subtotal`, `serviceFee`, `discount`, `deliveryAddress`, `deliveryInstructions`,
`estimatedPrepTimeMinutes`, `estimatedDeliveryTime`, `cancellationReason`, and
the full timestamp set (`createdAt`, `acceptedAt`, `readyAt`, `pickedUpAt`,
`inTransitAt`, `deliveredAt`, `completedAt`, `cancelledAt`).

## 5. `itemCount` vs `items` — you need both fallbacks, and here is why

They are on **different DTOs**, and neither has both:

| | `itemCount` | `items[]` |
|---|---|---|
| `CourierOrderDto` (REST: active orders, order details, complete) | **Yes** | No |
| `OrderDto` (WebSocket) | **No** | **Yes** |

So a screen fed by REST reads `itemCount`; the same screen patched from the
socket loses it and must count `items`. Your `itemCount ?? items?.length ?? 0`
is exactly right and should stay.

`OrderItemDto` carries: `id`, `menuItemId`, **`itemName`**, `quantity`,
`unitPrice`, `totalPrice`, `variantName`, `variantPriceDelta`, `modifiers[]`
(`{id, name, price}`), `modifiersTotal`, `specialInstructions`.

**The name field is `itemName`.** Not `name`, not `menuItemName`. If you render
`{quantity}x {name}` you are printing `2x undefined` — and since the whole array
only appears on the socket shape, it would look like an intermittent bug rather
than a constant one.

## 6. Units and formats

**Money: decimal so'm, not minor units.** Every amount is a `BigDecimal`
serialised as a JSON number with two decimal places — `5000.00`, not `500000`
and not `"5000"`. Treating them as integer so'm is right in value; just do not
assume the JSON is an integer, because `5000.00` parsed strictly as one will
surprise you. There is no tiyin anywhere in the system.

**Distance: none of those three fields exist.** `estimatedDistance`,
`pickupDistance` and `deliveryDistance` appear nowhere in the backend. Whatever
your screens format as metres is `undefined` today, on every order.

There is exactly one distance field in the whole API: **`distanceKm` on
`RestaurantDto`**, a decimal in **kilometres** (`2.4` = 2.4 km), present only
when the request supplies `lat`/`lng`. It is the customer-facing
restaurant-card distance, not a courier leg.

So the courier app has no pickup or delivery distance to show, and cannot get
one from us today. We have the coordinates on both ends — `restaurantLat/Lng`
and `deliveryLat/Lng` are on `CourierOrderDto` — so you can compute a straight
line, or tell us you want `pickupDistanceKm` and `deliveryDistanceKm` computed
server-side with the same routing the customer ETA uses. That is the better
answer and we would rather build it than have you approximate, but it is not a
field we are going to invent the name of without you.

**Timestamps: ISO 8601 with no timezone at all.** These are Java
`LocalDateTime`, so they serialise as `2026-09-23T15:16:11.737887` — no `Z`, no
offset. The JVM runs in UTC, so **the values are UTC**, but nothing in the
string says so. A client that parses them as local time will be wrong by the
device's offset — five hours in Uzbekistan. Parse as UTC explicitly.

That is a wart, not a design. We are not changing it in a hurry because every
shipped client currently guesses the same way, but if you want them emitted with
a `Z` we will coordinate it as a single change across all three apps.

## 7. `GET /couriers/me/earnings`

**Every name you listed matches.** `todayEarnings`, `weekEarnings`,
`monthEarnings`, `totalEarnings`, `cashEarnings`, `cardEarnings`,
`withdrawableBalance`, `todayDeliveries`, `weekDeliveries`, `monthDeliveries`,
`totalDeliveries`, `averagePerDelivery` — all present, all spelled as you have
them. Earnings are `BigDecimal`, delivery counts are `Integer`.

One you do not have: `pendingPayout`.

A caution rather than a contract note: these figures were wrong until recently —
a flat 5.00 per delivery, and queries that only counted `DELIVERED` orders, so a
courier's today-total *decreased* when orders auto-completed. Fixed and
backfilled in `V52`. If a courier reports a number that looks wrong, tell us
rather than assuming it is a display bug.

## 8. The two from before

**`PUT /couriers/me` and `PUT /couriers/me/status` returning 404.** We cannot
reproduce this from the code, and we would rather say so than invent a cause.
`GET /me`, `PUT /me` and `PUT /me/status` all resolve identically — each calls
`getCourierByUserId(currentUser.getId())` and then uses the returned courier's
id. There is no second lookup by a different key.

What would produce that message legitimately: the account holds `ROLE_COURIER`
but has no courier profile row. The error then reads *"No courier profile exists
for this account (user N). Register one with POST /api/v1/couriers/register"* —
and it would fail on `GET` too.

Send us the exact request and the exact response body and we will trace it:

```bash
curl -i -X PUT https://zbrr.uz/api/v1/couriers/me/status \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"status":"ONLINE"}'
```

Note `PUT /me/status` takes `{"status":"ONLINE"}` as a **body**, while
`PATCH /me/status` takes `?status=ONLINE` as a **query parameter**. Sending the
body to the PATCH gives a 400 that is easy to misread.

**`/app/version`.** You were right, and it was worse than a stale value: the
endpoint keyed only on platform, so it answered every app with the *customer*
app's version and the customer app's store link. A courier tapping "update"
installed a different app.

It now takes `app` as well:

```
GET /api/v1/app/version?platform=ios&app=courier
```

`app` accepts `customer`, `courier`, `vendor` (`owner` and `restaurant` are
accepted as aliases for vendor), and defaults to `customer` when omitted, which
is what shipped builds send.

**Until someone gives us the courier app's real store URLs, `storeUrl` is
omitted from your answer rather than wrong** — we deliberately do not fall back
to another app's link. Send us the App Store and Play URLs and your real
`latest`/`minimum`, and they go in as configuration, no release needed.

---

## What we changed, so you can decide when to drop the fallbacks

Deployed together:

1. Push data now carries `newStatus`, `previousStatus`, `reason` and the rest —
   the map that was being dropped (§1).
2. `actionUrl` is now in the push data (§2).
3. `restaurantPhone` added to `OrderDto`, so the socket carries it (§4).
4. `/app/version` takes `app`, and never hands out another app's store link (§8).

Not changed, awaiting your call: a distinct notification type for "assigned to
you" versus "available to all" (§2), an `earnings` field on `/complete` (§3),
and `Z`-suffixed timestamps (§6). All three are small; all three change
something you already branch on, which is why we are asking first.

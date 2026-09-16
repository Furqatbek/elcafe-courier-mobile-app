# Waking the courier app — for the backend team

How to make a courier's phone alert them about a new order **without the backend
holding a connection per courier**.

---

## The short version

There is no endpoint on the phone to call. A mobile app cannot expose one: the
device sits behind carrier NAT with no inbound reachability, its IP changes as
it moves between cells and Wi-Fi, and the OS suspends the process within seconds
of the courier leaving the app. Nothing you could POST to would be listening.

What replaces it is the **device token**, which the app already registers with
you at `POST /api/v1/device-tokens`. That token *is* the app's address. You POST
to Google (FCM) or Apple (APNs), they deliver to the device, and the OS wakes the
app. The only persistent socket involved belongs to the operating system, is
shared by every app on the phone, and is not yours to hold.

So the answer to "a thousand couriers means a thousand connections" is: with
push, it means **zero**. You make one HTTPS request per alert to a service built
to fan out billions of them.

This is not a new integration. The app has registered device tokens and handled
`NEW_DELIVERY_AVAILABLE` for some time. What changed on the app side, and what
this document is for, is that **the payload now drives the whole offer screen**,
so a courier sees the restaurant, the money and the destination without the app
having to call you back or hold a socket open.

---

## 1. Send this

`type` and `orderId` are the only required fields. Everything else makes the
offer card show a real job instead of a shell — send all of it.

```json
{
  "type": "NEW_DELIVERY_AVAILABLE",
  "orderId": "77",
  "externalOrderNo": "ORD-2026-000077",
  "restaurantId": "3",
  "restaurantName": "Osh Markazi",
  "restaurantAddress": "Amir Temur 1, Toshkent",
  "restaurantLat": "41.3110810",
  "restaurantLng": "69.2405620",
  "deliveryAddress": "Mustaqillik 15, kv 42",
  "deliveryLat": "41.3200000",
  "deliveryLng": "69.2500000",
  "deliveryFee": "15000",
  "tipAmount": "0",
  "total": "85000",
  "itemCount": "3",
  "createdAt": "2026-09-16T10:02:11Z",
  "expiresAt": "2026-09-16T10:03:11Z"
}
```

**Every value is a string.** That is not a style choice: FCM data payloads are
`Map<String, String>` and the transport will reject or stringify anything else.
APNs allows real JSON types and the app accepts both, but sending strings
everywhere means one code path on your side and one payload to reason about.

| Field | Why the app wants it |
|---|---|
| `type` | Must be exactly `NEW_DELIVERY_AVAILABLE`. Anything else is treated as a general notification and will not raise the offer screen. |
| `orderId` | Required. Without it there is nothing to accept or open, and the push is discarded. |
| `deliveryFee`, `tipAmount` | The courier is being asked to accept a job. These are the pay. An offer with no money shown is one they cannot judge. |
| `restaurantName`, `deliveryAddress` | Where from and where to. |
| `restaurantLat/Lng`, `deliveryLat/Lng` | The app computes and shows distance itself — you do not filter by it. |
| `itemCount`, `total` | Size of the job. |
| `expiresAt` | When the offer stops being valid. Drives the countdown. |

Omitted fields are fine. If the payload is too thin to be worth showing — an id
and nothing else — the app does **not** render an empty card; it refetches
`GET /couriers/me/available-orders` and picks the order up from there. The push
has still done its job by waking the app. That fallback costs you one extra
request per push, so it is worth filling the payload in.

`orderNumber` is accepted as an alias for `externalOrderNo`, so a service still
sending the old name keeps working.

---

## 2. Android (FCM HTTP v1)

```bash
curl -X POST \
  "https://fcm.googleapis.com/v1/projects/$FCM_PROJECT_ID/messages:send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "<the device token from POST /device-tokens>",
      "data": {
        "type": "NEW_DELIVERY_AVAILABLE",
        "orderId": "77",
        "externalOrderNo": "ORD-2026-000077",
        "restaurantName": "Osh Markazi",
        "deliveryAddress": "Mustaqillik 15, kv 42",
        "restaurantLat": "41.3110810",
        "restaurantLng": "69.2405620",
        "deliveryLat": "41.3200000",
        "deliveryLng": "69.2500000",
        "deliveryFee": "15000",
        "tipAmount": "0",
        "total": "85000",
        "itemCount": "3",
        "expiresAt": "2026-09-16T10:03:11Z"
      },
      "notification": {
        "title": "Yangi buyurtma",
        "body": "Osh Markazi — 15 000 so'\''m"
      },
      "android": {
        "priority": "HIGH",
        "ttl": "60s",
        "notification": {
          "channel_id": "orders_v2",
          "sound": "default",
          "notification_priority": "PRIORITY_MAX"
        }
      }
    }
  }'
```

Four things here are load-bearing:

**`channel_id` must be `orders_v2`.** The app creates that channel at startup
with `IMPORTANCE_HIGH`. Android routes a notification by channel id, and one
addressed to a channel that does not exist is **silently dropped** — no error,
no delivery, nothing in your logs. If you ever need to change the channel's
importance you must use a **new** channel id and tell the app team, because
Android freezes importance at creation and ignores later changes.

**`priority: HIGH`** is what lets the message wake a device in Doze. Normal
priority is batched and may sit for minutes, which for a 60-second order offer
means it arrives after the offer is gone.

**`ttl: 60s`** should match how long the offer is actually live. The default is
four weeks. Without a TTL, a phone that was off comes back online and is handed
a pile of offers that expired hours ago.

**Send `data` AND `notification`.** The `data` block is what the app parses. The
`notification` block is what Android shows when the app is killed — with data
alone, a killed app displays nothing at all and the courier never knows.

---

## 3. iOS (APNs)

```bash
curl -X POST \
  --http2 \
  -H "apns-topic: app.zbr.courier" \
  -H "apns-push-type: alert" \
  -H "apns-priority: 10" \
  -H "apns-expiration: $(( $(date +%s) + 60 ))" \
  -H "authorization: bearer $APNS_JWT" \
  -d '{
    "aps": {
      "alert": { "title": "Yangi buyurtma", "body": "Osh Markazi — 15 000 so'\''m" },
      "sound": "default",
      "interruption-level": "time-sensitive"
    },
    "type": "NEW_DELIVERY_AVAILABLE",
    "orderId": "77",
    "restaurantName": "Osh Markazi",
    "deliveryFee": "15000",
    "deliveryAddress": "Mustaqillik 15, kv 42",
    "itemCount": "3",
    "expiresAt": "2026-09-16T10:03:11Z"
  }' \
  "https://api.push.apple.com/3/device/<device token>"
```

**`apns-topic` must be the app's bundle id, `app.zbr.courier`.** APNs rejects
anything else outright. The app sends its real bundle id in the `appId` field of
`POST /device-tokens` precisely so you can use it here.

**`interruption-level: time-sensitive`** lets the alert through Focus modes. A
courier with Do Not Disturb on is otherwise unreachable, which for an order
offer is the same as not sending it.

`apns-priority: 10` for immediate delivery, and `apns-expiration` so a stale
offer is discarded rather than delivered late.

Custom keys sit **beside** `aps`, not inside it.

---

## 4. Which token to send to

`POST /api/v1/device-tokens` gives you, per device:

```json
{ "token": "…", "platform": "ANDROID", "deviceId": "a1b2c3d4",
  "deviceName": "Redmi Note 12", "appId": "app.zbr.courier", "appVersion": "1.0.3" }
```

- `platform` decides FCM vs APNs.
- `appId` is the APNs topic.
- A courier may have several devices. Send to all of their live tokens.
- **Only send to couriers who are `AVAILABLE`.** An offline courier gets woken
  for work they cannot take, and the app suppresses the offer anyway.

### Retiring dead tokens

Tokens die — reinstalls, restores, OS-driven rotation. Both services tell you:

- FCM returns `UNREGISTERED` or `INVALID_ARGUMENT` → delete that row.
- APNs returns `410 Unregistered` → delete that row.

If you do not prune, your send volume grows with churn while delivery does not,
and a courier's old phone keeps buzzing for orders someone else is doing.

The app calls `DELETE /device-tokens` with `{ "deviceToken": "…" }` on logout.
Note the field name: registering uses `token`, removing uses `deviceToken`.

---

## 5. What the app does on receipt

| App state | What the courier sees |
|---|---|
| Open and `AVAILABLE` | Full-screen offer with a countdown, sound and vibration, built from your payload. No call back to you. |
| Open and offline | A toast only. The offer is suppressed — they are not working. |
| Backgrounded | System notification. Tapping opens the order. |
| Killed | System notification (this is why the `notification` block matters). Tapping cold-starts the app, which fetches the order list so the screen has data to show. |

On iOS a killed app **cannot** be made to draw a full-screen offer. Only a
notification is possible, and the courier taps it. No payload changes that; it
is how the platform works.

---

## 6. Do you still need the WebSocket?

Not for this. The app can run with STOMP switched off entirely
(`EXPO_PUBLIC_WEBSOCKET_ENABLED=false`) and lose nothing about order alerts,
because alerts were never the socket's job — a socket only delivers while the
app is foregrounded and connected, which is exactly when a riding courier is not
looking at it.

What the socket does add is in-app liveness while they *are* looking: an order
vanishing from the list the moment another courier takes it, status changes
landing without waiting for the next poll. Pleasant, not load-bearing. With it
off, those screens fall back to the existing foreground poll and are a few
seconds staler.

One correction worth making, though, because it affects what you decide to
build: **a thousand concurrent WebSockets is not a lot.** An idle connection is
some kernel buffer and a little heap — a few MB across a thousand, and modern
servers hold tens of thousands routinely. If a thousand sockets is causing
latency today, the cause is more likely per-message fan-out work, a thread-per-
connection model, or a proxy limit than the connection count itself, and moving
to push will not fix those if they also sit in the send path.

Push is still the right primary channel — not because sockets are expensive, but
because **push reaches a phone that a socket cannot**: backgrounded, screen off,
app killed. That is where couriers actually are. Choose it for reach, and treat
the saved connections as a bonus rather than the reason.

---

## 7. Proving it works

1. `POST /device-tokens` from a real device, and confirm the row.
2. Send the FCM payload above to that token with the app **open** — the offer
   screen appears with the restaurant, the money and the address filled in. If
   any of those are blank, a field is missing from your `data` block.
3. Background the app and send again — a system notification appears. Tap it;
   the order opens.
4. **Force-kill the app and send again.** This is the one that catches a missing
   `notification` block, and it is the case that matters most: a courier's phone
   in their pocket.
5. Send with `channel_id` deliberately wrong — nothing should arrive. That is
   what a channel mismatch looks like in production, and it is worth seeing once
   so it is recognisable.
6. Turn on battery optimisation for the app on a Xiaomi, Huawei, Oppo or Realme
   device and repeat step 4. These vendors delay or drop high-priority push
   aggressively; couriers should be prompted to exempt the app, and you should
   know what the delay looks like before a courier reports it as a missed order.

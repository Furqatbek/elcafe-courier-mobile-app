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

## 4b. If push arrives SILENTLY

Reported from the field: notifications land, but with no sound. Everything the
app controls is already set — the `orders_v2` channel is created at startup with
`IMPORTANCE_HIGH` and `sound: 'default'`, `defaultChannel` is `orders_v2` so an
FCM message that names no channel still lands there, and the foreground handler
returns `shouldPlaySound: true`. So the remaining causes are in the payload or
on the device.

**Check the payload first.**

- **iOS: `aps.sound` must be present.** Omit it and APNs delivers the alert
  silently — it is not a default, it is an opt-in. `"sound": "default"` is the
  minimum; `interruption-level: time-sensitive` additionally gets it past Focus
  and Do Not Disturb, which a courier on shift very often has on.
- **Android: send `android.notification.sound` as well as the channel.** The
  channel supplies the sound only when the message does not override it, and
  some senders set an empty sound field, which counts as an override to silence.

**Then check the channel on the device.** Android freezes a channel's settings
at creation. If any earlier build created `orders_v2` with a different sound or
importance, the current definition is ignored, forever, for that install —
changing the app does nothing. Confirm on a real device:

```
Settings → Apps → ZBR Courier → Notifications → New Orders
```

If sound is off or importance is not "Urgent" there, the channel is stale.
Reinstalling fixes that install; fixing it for everyone needs a **new channel
id** and a matching backend change, because Android will not take an update to
an existing one.

**And check the obvious.** Ring/silent switch, per-app notification volume, and
on Xiaomi/Huawei/Oppo the vendor's own notification settings, which are separate
from Android's and frequently default to silent for apps installed recently.

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

---

# Appendix — `GET /api/v1/app/version`

The app polls this on launch and on resume to decide whether to nag a courier to
update, or to stop them using a build you no longer support.

```
GET /api/v1/app/version?platform=ios|android      (no token)
```

`platform` is always sent — `ios` or `android`, lower case, from the app's own
platform abstraction rather than a user-agent guess.

An earlier draft of this appendix asked for the endpoint to sit outside
`/api/v1`, reasoning that the version check must survive the rest of the API
moving to a version the build cannot speak. The backend team pushed back, and
they were right: `/api/v1` is a path prefix, not content negotiation, and one
endpoint spelled differently from every other is a bigger hazard than the one it
guarded against. **The app calls `/api/v1/app/version`.**

```json
{ "success": true,
  "data": { "latestVersion": "1.0.2",
            "minimumVersion": "1.0.0",
            "storeUrl": "https://play.google.com/store/apps/details?id=app.zbr.courier" } }
```

Verify a change with the two calls the app actually makes:

```bash
curl -s 'https://<host>/api/v1/app/version?platform=android' | jq .
curl -s 'https://<host>/api/v1/app/version?platform=ios'     | jq .
```

The `storeUrl` in each must carry the identity in the table further down —
`id=app.zbr.courier` for Android, `id6807758268` for iOS.

Bare objects are accepted too; the envelope is unwrapped if present.

| Field | Effect |
|---|---|
| `latestVersion` | Installed version below it → non-blocking toast with an "Update" action. |
| `minimumVersion` | Installed version below it → **blocking dialog**, no way past. |
| `updateRequired` | Optional. Promotes an optional update to blocking. Cannot create one: a courier already on the newest build is never blocked, because the dialog's only button would send them to a store page reading "Open". |
| `storeUrl` | Optional. Used only if it points at **this app** on **this platform** — see below. |

## The store URL is checked twice

Host **and** app identity.

The host check catches a Play link sent to an iPhone. The identity check catches
the subtler case: the seeded config returns
`play.google.com/store/apps/details?id=app.zbr.customer` — the **customer** app.
Right host, right platform, wrong product. A courier tapping "Update" would have
installed a different app and still not had the update, with no error anywhere.

The app compares the `id=` package (Android) or the `id<digits>` (Apple) against
its own configured listing, so a mismatch is discarded and the built-in link is
used instead. Nothing breaks — but the field is then doing nothing, so it is
worth correcting.

**Ours are:**

```
android   app.zbr.courier
          https://play.google.com/store/apps/details?id=app.zbr.courier
ios       6807758268
          https://apps.apple.com/app/id6807758268
```

## What to set, and when

`latestVersion` must name a build that is **actually downloadable right now**,
not the newest one uploaded. Store review and staged rollout both mean a build
exists without being installable: a courier prompted to update to a version the
store will not yet serve taps "Update", lands on a page offering the build they
already have, and learns to ignore the prompt.

So the rule is: **bump `latestVersion` when the release goes live, not when it
is submitted.** It is per-platform — the same `platform` parameter already
splits the response — and the two stores do not release in step.

Current state, to keep this honest as it moves:

| | iOS | Android |
|---|---|---|
| Live on the store | `1.0.2` | `1.0.1` |
| Uploaded, not yet live | `1.0.3` | `1.0.3` |
| Set `latestVersion` to | `1.0.2` → `1.0.3` once released | `1.0.1` → `1.0.3` once rolled out |
| Set `minimumVersion` to | `1.0.0` | `1.0.0` |

**`1.0.1` must never be a `minimumVersion` on iOS.** That build crashes on
launch on every device — a native ABI mismatch, fixed in 1.0.2. A minimum of
`1.0.1` would force the fleet onto a build that cannot start, and the app they
would be updating from is the only thing still working. Raising the iOS minimum
past it is also pointless: a courier on iOS 1.0.1 never reaches the version
check, because the app aborts before it runs.

Leave `minimumVersion` at `1.0.0` on both platforms until there is a real reason
to lock a build out. The blocking dialog has no way past it, so it is the one
field here that can strand a working courier mid-delivery.

## Versions are compared numerically

`1.10.0` is newer than `1.9.0`; `2.0.0` is newer than `1.99.99`. Send plain
`MAJOR.MINOR.PATCH`. Prerelease and build metadata (`1.2.3-beta+sha`) are
ignored rather than ranked, so do not use them to express ordering.

Anything unparseable is treated as "no opinion" and the courier is left alone —
the check fails **open**, because a malformed version string must never lock a
working app.

## `?version=` — not needed

Thank you for offering to compute `updateRequired` server-side. The app already
compares locally and must keep doing so: the comparison has to work identically
whether the response is fresh or five minutes stale from cache, and two places
deciding the same thing is two places that can disagree. Sending the installed
version would also make the response uncacheable per-courier, which the 300s
`Cache-Control` currently avoids.

## Rate

At most one request per courier per hour, and no re-prompt about the same
version for 24 hours after they have seen it. A new `latestVersion` prompts
immediately regardless. `Cache-Control: public, max-age=300` is more than enough.

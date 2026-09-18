# Bug report — `PUT /couriers/me` and `PUT /couriers/me/status` return 404

**Severity: couriers cannot go online.** This is the app's core function; with it
broken the app has no use, and an App Store or Play reviewer opening the demo
account hits it within seconds of logging in.

---

## Symptom

```
PUT /api/v1/couriers/me/status     → 404  "profile with id={ID} not found"
PUT /api/v1/couriers/me            → 404  "profile with id={ID} not found"
```

The courier exists. The row is visible in the database with that profile.

## The app sends no id

Neither request carries one — not in the path, not in the body, nowhere:

```
PUT /api/v1/couriers/me/status     body: {"status":"AVAILABLE"}
PUT /api/v1/couriers/me            body: {"vehicleType":"MOTORCYCLE"}
```

The only place the courier app interpolates a courier id anywhere is the
WebSocket location topic. So the `{ID}` in that message is one **the backend
derived from the bearer token itself**.

## The decisive evidence: GET on the same path works

`GET /api/v1/couriers/me` succeeds with the same token, in the same session,
moments earlier — that is how the profile is on screen for the courier to edit.

Same URL. Same auth. Same courier. **GET finds it, PUT does not.**

The route resolves, the token is valid, and the courier is findable. The only
thing that differs between the two is how each handler looks the courier up.

## Probable cause

`GET /couriers/me` returns both ids:

```json
{ "id": 9, "userId": 42 }
```

`id` is the courier profile's primary key. `userId` is the user. Your own
`COURIER_API_REFERENCE.md` flags the hazard:

> Note `GET /couriers/me` returns both `id` (courier profile id) and `userId`.
> … **Confusing them is the most common mistake here.**

The signature fits exactly. The PUT handlers appear to take the user id from the
token and call `findById(42)` on the couriers table, where the GET handler calls
`findByUserId(42)`. Row `id=9, userId=42` exists — which is why it is visible in
the database — and `findById(42)` returns nothing. Hence *"profile with id=42
not found."*

If that is right it is one line in each of the two handlers.

## Confirm or refute in 30 seconds

```bash
BASE=https://zbrr.uz/api/v1
TOKEN='<accessToken from verify-otp>'

# 1. What the backend CAN find, and both ids:
curl -s -H "Authorization: Bearer $TOKEN" $BASE/couriers/me | jq '.data|{id,userId}'

# 2. The failing calls:
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"AVAILABLE"}' $BASE/couriers/me/status
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"vehicleType":"MOTORCYCLE"}' $BASE/couriers/me
```

**If the id in the 404 equals `userId` and not `id`, the diagnosis above is
confirmed.** If it equals `id`, the lookup is right and something else is wrong —
send the output and we will look again.

## Also worth trying

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  "$BASE/couriers/me/status?status=AVAILABLE"
```

The reference documents this PATCH variant. If **PATCH succeeds where PUT
fails**, that proves the fault is in the individual handlers rather than in
shared auth resolution — and it gives a stopgap: the app can be pointed at PATCH
in a few minutes while the PUT handlers are fixed.

That stopgap has NOT been implemented. It papers over a real backend bug and the
reference explicitly says to use the PUT, so it is worth doing only if the fix
cannot ship quickly. Say the word and it is a small change.

## Once fixed

Re-run the two curls — both should return 200 with the updated `CourierDto`.
Then in the app: go online, confirm the status toggle sticks, and change the
vehicle type on the profile screen.

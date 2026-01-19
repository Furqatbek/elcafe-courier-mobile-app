# Courier App API Documentation

API endpoints for the **Courier App** (Mobile) frontend application.

**Target Users:** COURIER role

**Base URL:** `http://localhost:8080/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Courier Registration](#2-courier-registration)
3. [Status Management](#3-status-management)
4. [Location Updates](#4-location-updates)
5. [Order Management](#5-order-management)
6. [Earnings & History](#6-earnings--history)
7. [Notifications](#7-notifications)
8. [WebSocket (Real-time)](#8-websocket-real-time)

---

## 1. Authentication

### Login
```
POST /auth/login
```

**Request:**
```json
{
  "emailOrPhone": "courier@fooddelivery.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": 5,
      "email": "courier@fooddelivery.com",
      "fullName": "Alex Courier",
      "roles": ["CONSUMER", "COURIER"]
    }
  }
}
```

### Phone OTP Login
```
POST /auth/phone/request-otp
POST /auth/phone/verify-otp
```
*Same as Consumer App*

### Refresh Token
```
POST /auth/refresh
```

### Get Current User
```
GET /auth/me
Authorization: Bearer {token}
```

---

## 2. Courier Registration

### Register as Courier

> **Prerequisite:** User must have CONSUMER role first

```
POST /couriers/register
Authorization: Bearer {token}
```

**Request:**
```json
{
  "vehicleType": "MOTORCYCLE",
  "vehicleNumber": "01A123BC",
  "licenseNumber": "DL123456789",
  "preferredRadiusKm": 10
}
```

**Vehicle Types:** `BICYCLE`, `MOTORCYCLE`, `CAR`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 5,
    "userName": "Alex Courier",
    "email": "courier@fooddelivery.com",
    "phone": "+998901234567",
    "status": "PENDING_APPROVAL",
    "vehicleType": "MOTORCYCLE",
    "vehicleNumber": "01A123BC",
    "verified": false,
    "currentOrderCount": 0,
    "totalDeliveries": 0,
    "averageRating": null
  }
}
```

### Get My Courier Profile

> **Required Role:** COURIER

```
GET /couriers/me
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 5,
    "userName": "Alex Courier",
    "email": "courier@fooddelivery.com",
    "phone": "+998901234567",
    "status": "AVAILABLE",
    "vehicleType": "MOTORCYCLE",
    "vehicleNumber": "01A123BC",
    "currentLat": 41.2995,
    "currentLng": 69.2401,
    "verified": true,
    "verifiedAt": "2024-01-10T10:00:00Z",
    "currentOrderCount": 1,
    "maxConcurrentOrders": 3,
    "totalDeliveries": 156,
    "averageRating": 4.8,
    "todayEarnings": 125000,
    "weeklyEarnings": 850000
  }
}
```

### Update Courier Profile
```
PUT /couriers/me
Authorization: Bearer {token}
```

**Request:**
```json
{
  "vehicleType": "CAR",
  "vehicleNumber": "01A456DE",
  "preferredRadiusKm": 15
}
```

---

## 3. Status Management

> **Required Role:** COURIER

### Update Status (Go Online/Offline)
```
PUT /couriers/me/status
Authorization: Bearer {token}
```

**Request:**
```json
{
  "status": "AVAILABLE"
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `OFFLINE` | Not accepting orders |
| `AVAILABLE` | Ready to accept orders |
| `BUSY` | At max capacity |
| `ON_BREAK` | Temporary break |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "AVAILABLE",
    "message": "You are now online and can receive orders"
  }
}
```

### Courier Status Flow

```
                    ┌──────────────┐
                    │   OFFLINE    │
                    │ (Not working)│
                    └──────┬───────┘
                           │ Go Online
                           ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   ON_BREAK   │◄──►│  AVAILABLE   │◄──►│     BUSY     │
│  (Paused)    │    │(Ready for    │    │(Max orders)  │
└──────────────┘    │   orders)    │    └──────────────┘
                    └──────────────┘
                           │ Go Offline
                           ▼
                    ┌──────────────┐
                    │   OFFLINE    │
                    └──────────────┘
```

---

## 4. Location Updates

> **Required Role:** COURIER

### Update Current Location
```
PUT /couriers/me/location
Authorization: Bearer {token}
```

**Request:**
```json
{
  "latitude": 41.3001,
  "longitude": 69.2450,
  "accuracy": 10.5,
  "heading": 180,
  "speed": 25.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location updated"
}
```

### Best Practices for Location Updates

| Scenario | Update Frequency |
|----------|------------------|
| Idle (Available) | Every 30 seconds |
| Active Delivery | Every 5-10 seconds |
| Moving Fast | Every 3-5 seconds |

---

## 5. Order Management

> **Required Role:** COURIER

### Get Available Orders (Nearby)
```
GET /couriers/me/available-orders
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| lat | decimal | Current latitude |
| lng | decimal | Current longitude |
| radiusKm | decimal | Search radius (default: from profile) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "orderId": 456,
      "orderNumber": "ORD-2024-0456",
      "restaurant": {
        "id": 1,
        "name": "Pizza Palace",
        "address": "123 Main Street",
        "latitude": 41.2995,
        "longitude": 69.2401,
        "distance": 1.2
      },
      "deliveryAddress": {
        "fullAddress": "456 Elm Street, Apt 5A",
        "latitude": 41.3112,
        "longitude": 69.2797,
        "distance": 3.5
      },
      "estimatedDistance": 4.7,
      "estimatedEarnings": 18000,
      "itemCount": 3,
      "createdAt": "2024-01-15T12:30:00Z"
    }
  ]
}
```

### Accept Order
```
POST /couriers/me/orders/{orderId}/accept
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": 456,
    "orderNumber": "ORD-2024-0456",
    "status": "PICKED_UP",
    "restaurant": {
      "id": 1,
      "name": "Pizza Palace",
      "address": "123 Main Street",
      "phone": "+998901234567",
      "latitude": 41.2995,
      "longitude": 69.2401
    },
    "customer": {
      "name": "John D.",
      "phone": "+998907654321"
    },
    "deliveryAddress": {
      "fullAddress": "456 Elm Street, Apt 5A",
      "latitude": 41.3112,
      "longitude": 69.2797,
      "instructions": "Ring doorbell twice"
    },
    "items": [
      {
        "name": "Margherita Pizza (Large)",
        "quantity": 2
      },
      {
        "name": "Coca-Cola",
        "quantity": 1
      }
    ],
    "paymentMethod": "CARD",
    "isPaid": true,
    "totalAmount": 125000
  }
}
```

### Get My Active Orders
```
GET /couriers/me/orders/active
Authorization: Bearer {token}
```

### Get Order Details
```
GET /couriers/me/orders/{orderId}
Authorization: Bearer {token}
```

### Update Order Status

#### Picked Up from Restaurant
```
PUT /couriers/me/orders/{orderId}/pickup
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": 456,
    "status": "PICKED_UP",
    "message": "Order picked up. Navigate to delivery address."
  }
}
```

#### Start Transit
```
PUT /couriers/me/orders/{orderId}/transit
Authorization: Bearer {token}
```

#### Complete Delivery
```
POST /couriers/me/orders/{orderId}/complete
Authorization: Bearer {token}
```

**Request (optional):**
```json
{
  "deliveryPhoto": "base64_encoded_image",
  "deliveryNotes": "Left at door as requested"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": 456,
    "status": "DELIVERED",
    "earnings": 18000,
    "message": "Delivery completed! +18,000 UZS earned."
  }
}
```

### Report Issue with Order
```
POST /couriers/me/orders/{orderId}/issue
Authorization: Bearer {token}
```

**Request:**
```json
{
  "issueType": "CUSTOMER_UNAVAILABLE",
  "description": "Customer not answering phone",
  "photos": ["base64_image_1"]
}
```

**Issue Types:**
- `CUSTOMER_UNAVAILABLE`
- `WRONG_ADDRESS`
- `RESTAURANT_DELAY`
- `ACCIDENT`
- `VEHICLE_ISSUE`
- `OTHER`

---

## 6. Earnings & History

> **Required Role:** COURIER

### Get Earnings Summary
```
GET /couriers/me/earnings
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | TODAY, THIS_WEEK, THIS_MONTH, CUSTOM |
| startDate | date | For CUSTOM period |
| endDate | date | For CUSTOM period |

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "THIS_WEEK",
    "totalEarnings": 850000,
    "deliveryFees": 720000,
    "tips": 130000,
    "totalDeliveries": 45,
    "avgPerDelivery": 18889,
    "onlineHours": 38.5,
    "breakdown": [
      {"date": "2024-01-15", "earnings": 125000, "deliveries": 7},
      {"date": "2024-01-14", "earnings": 145000, "deliveries": 8}
    ]
  }
}
```

### Get Delivery History
```
GET /couriers/me/orders/history
Authorization: Bearer {token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | int | Page number |
| size | int | Page size |
| dateFrom | date | Start date |
| dateTo | date | End date |

### Get Single Delivery Details
```
GET /couriers/me/orders/{orderId}
Authorization: Bearer {token}
```

---

## 7. Notifications

### Get Notifications
```
GET /notifications
Authorization: Bearer {token}
```

### Get Unread Count
```
GET /notifications/unread/count
Authorization: Bearer {token}
```

### Mark as Read
```
PUT /notifications/{id}/read
Authorization: Bearer {token}
```

### Notification Types for Courier

| Type | Description |
|------|-------------|
| `NEW_ORDER_NEARBY` | New order available in your area |
| `ORDER_ASSIGNED` | Order assigned to you |
| `ORDER_CANCELLED` | Order was cancelled |
| `PAYOUT_ISSUED` | Payout sent to your account |
| `VERIFICATION_APPROVED` | Courier profile verified |
| `RATING_RECEIVED` | New rating from customer |

---

## 8. WebSocket (Real-time)

### Connection
```
ws://localhost:8080/ws
```

**STOMP CONNECT Headers:**
```
Authorization: Bearer {accessToken}
```

### Subscribe to Channels

```javascript
const stompClient = Stomp.over(new SockJS('/ws'));

stompClient.connect(
  { 'Authorization': 'Bearer ' + accessToken },
  function(frame) {
    // New orders nearby
    stompClient.subscribe('/user/queue/orders/new', function(message) {
      const order = JSON.parse(message.body);
      showNewOrderNotification(order);
    });

    // Order updates for assigned orders
    stompClient.subscribe('/topic/orders/{orderId}/status', function(message) {
      const status = JSON.parse(message.body);
      updateOrderStatus(status);
    });

    // Personal notifications
    stompClient.subscribe('/user/queue/notifications', function(message) {
      const notification = JSON.parse(message.body);
      showNotification(notification);
    });
  }
);
```

### Topics for Courier

| Topic | Description |
|-------|-------------|
| `/user/queue/orders/new` | New order offers in your area |
| `/topic/orders/{orderId}/status` | Status updates for your orders |
| `/user/queue/notifications` | Personal notifications |

### New Order Notification Format

```json
{
  "type": "NEW_ORDER",
  "orderId": 456,
  "orderNumber": "ORD-2024-0456",
  "restaurant": {
    "name": "Pizza Palace",
    "distance": 1.2
  },
  "deliveryDistance": 3.5,
  "estimatedEarnings": 18000,
  "expiresAt": "2024-01-15T12:35:00Z"
}
```

---

## Delivery Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COURIER DELIVERY FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  1. GO ONLINE                    2. RECEIVE ORDER               3. ACCEPT ORDER
  ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
  │  Set Status  │──────────────▶│  New Order   │──────────────▶│   Accept     │
  │  AVAILABLE   │               │  Notification│               │   Order      │
  └──────────────┘               └──────────────┘               └──────────────┘
                                                                       │
  ┌────────────────────────────────────────────────────────────────────┘
  │
  ▼
  4. NAVIGATE TO RESTAURANT       5. PICK UP ORDER               6. START DELIVERY
  ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
  │  Navigate    │──────────────▶│  Confirm     │──────────────▶│  Navigate    │
  │  to Pickup   │               │  Pickup      │               │  to Customer │
  └──────────────┘               └──────────────┘               └──────────────┘
                                                                       │
  ┌────────────────────────────────────────────────────────────────────┘
  │
  ▼
  7. ARRIVE AT DESTINATION        8. COMPLETE DELIVERY
  ┌──────────────┐               ┌──────────────┐
  │  Contact     │──────────────▶│  Mark as     │
  │  Customer    │               │  Delivered   │
  └──────────────┘               └──────────────┘
```

---

## Navigation Integration

### Get Navigation URL

The app can generate navigation URLs for popular map apps:

**Google Maps:**
```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

**Yandex Maps:**
```
https://yandex.com/maps/?rtext=~{lat},{lng}&rtt=auto
```

**Apple Maps:**
```
maps://maps.apple.com/?daddr={lat},{lng}
```

---

## Error Responses

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

### Common Errors

| Code | Message | Description |
|------|---------|-------------|
| 400 | "Courier must be verified before going online" | Need verification |
| 400 | "Order already has a courier assigned" | Order taken |
| 400 | "Order must be ready before courier assignment" | Order not ready |
| 403 | "This order is not assigned to you" | Wrong courier |
| 409 | "Courier is not available to accept orders" | Status conflict |

---

## Test Accounts

| Email | Role | Password | Status |
|-------|------|----------|--------|
| courier@fooddelivery.com | COURIER | password | Verified |

---

## Performance Tips

### Battery Optimization

1. Use efficient location tracking (GPS vs Network)
2. Batch location updates when idle
3. Reduce update frequency when stationary

### Network Optimization

1. Cache restaurant/order data locally
2. Use WebSocket for real-time updates (less battery than polling)
3. Retry failed requests with exponential backoff

### Recommended Update Intervals

| State | Location Update | API Poll |
|-------|-----------------|----------|
| Offline | None | None |
| Available (Idle) | 30s | WebSocket only |
| Active Delivery | 5-10s | WebSocket only |
| Background | 60s | None |

import { Client, IMessage, ReconnectionTimeMode, StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';
import { WEBSOCKET_CONFIG } from '@/constants/config';
import { log, warn, error as logError } from '@/lib/logger';

// WebSocket message types
// Matches the flat structure sent by the backend
export interface NewOrderNotification {
  type?: 'NEW_ORDER'; // Optional, defaults to NEW_ORDER
  orderId: number;
  externalOrderNo?: string;
  restaurantId: number;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantLat?: number;
  restaurantLng?: number;
  restaurantDistance?: number;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistance?: number;
  deliveryFee?: number;
  tipAmount?: number;
  total?: number;
  itemCount: number;
  createdAt?: string;
  readyAt?: string;
  expiresAt?: string;
}

export interface OrderTakenNotification {
  type: 'ORDER_TAKEN';
  orderId: number;
  externalOrderNo?: string;
  courierId: number;
  courierName?: string;
  timestamp: string;
}

// Union type for messages on the available-orders broadcast channel
// (topic 1 sends both new orders and ORDER_TAKEN alerts)
export type AvailableOrdersChannelMessage = NewOrderNotification | OrderTakenNotification;

/** @deprecated Use AvailableOrdersChannelMessage */
export type OrderChannelMessage = AvailableOrdersChannelMessage;

// Full OrderDto sent on /topic/orders/{orderId} (topic 3)
export interface OrderDto {
  id: number;
  externalOrderNo?: string;
  consumerId?: number;
  consumerName?: string;
  restaurantId: number;
  restaurantName?: string;
  courierId?: number;
  courierName?: string;
  orderType?: string;
  status: string;
  paymentStatus?: string;
  items?: unknown[];
  subtotal?: number;
  tax?: number;
  deliveryFee?: number;
  discount?: number;
  tipAmount?: number;
  total?: number;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  customerName?: string;
  customerPhone?: string;
  // Kitchen's number, distinct from customerPhone
  restaurantPhone?: string;
  notes?: string | null;
  estimatedPrepTimeMinutes?: number;
  estimatedDeliveryTime?: string;
  createdAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string | null;
  cancellationReason?: string | null;
}

/** @deprecated Use OrderDto */
export interface OrderStatusUpdate {
  orderId: number;
  status: string;
  updatedAt: string;
  message?: string;
}

// NotificationResponseDto (topics 5, 6, 7)
export interface WebSocketNotification {
  id: number;
  userId?: number | null;
  role?: string;
  roleDisplayName?: string;
  title: string;
  message: string;
  category?: string;
  categoryDisplayName?: string;
  notificationType?: string;
  notificationTypeDisplayName?: string;
  priority?: string;
  priorityDisplayName?: string;
  orderId?: number;
  relatedEntityId?: number;
  relatedEntityType?: string;
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  icon?: string;
  dismissed?: boolean;
  dismissedAt?: string | null;
  isRead?: boolean;
  isExpired?: boolean;
  timeAgo?: string;
  // Legacy fields for backward compatibility
  type?: string;
  data?: Record<string, unknown>;
}

// Location update confirmation (topic 8)
export interface LocationConfirmation {
  courierId: number;
  lat: number;
  lng: number;
  timestamp: string;
}

export type WebSocketMessageHandler<T> = (message: T) => void;

/**
 * Supplies the current access token before EVERY (re)connect attempt, so
 * stompjs reconnects never reuse a stale JWT. Return null if no token is
 * available (the connect attempt proceeds unauthenticated and will be
 * rejected by the server, then retried).
 */
export type AccessTokenProvider = () => Promise<string | null> | string | null;

interface SubscriptionInfo {
  destination: string;
  subscription: StompSubscription;
}

class WebSocketService {
  private client: Client | null = null;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private tokenProvider: AccessTokenProvider | null = null;
  // Set only when connect() was called with a raw string token, so repeated
  // connect(sameToken) calls stay idempotent (legacy call style)
  private staticToken: string | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  // True while a live STOMP session exists; lets close/disconnect handlers
  // notify exactly once per lost connection
  private wasConnected: boolean = false;
  private messageHandlers: Map<string, Set<WebSocketMessageHandler<unknown>>> = new Map();

  // Event callbacks
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private onErrorCallback?: (error: string) => void;

  /**
   * Initialize WebSocket connection with authentication.
   *
   * Preferred: pass an AccessTokenProvider — it is consulted via stompjs's
   * `beforeConnect` hook before EVERY (re)connect attempt, so automatic
   * reconnects always carry a fresh JWT. A raw string token is still accepted
   * for backward compatibility (it becomes a constant provider).
   */
  connect(tokenOrProvider: string | AccessTokenProvider): void {
    const isStatic = typeof tokenOrProvider !== 'function';
    const provider: AccessTokenProvider = isStatic ? () => tokenOrProvider : tokenOrProvider;

    // Idempotency: same auth source and a client that is already live or
    // in-flight — nothing to do.
    const sameAuthSource = isStatic
      ? this.staticToken === tokenOrProvider
      : this.tokenProvider === tokenOrProvider;
    if (this.client && sameAuthSource && (this.isConnecting || this.client.active)) {
      log('[WebSocket] Already connected or connecting');
      return;
    }

    // Auth source changed (or a stale client lingers): never allow two live
    // clients — cleanly deactivate the old one before creating the new one.
    if (this.client) {
      const oldClient = this.client;
      this.client = null;
      this.subscriptions.clear();
      // Intentional teardown: suppress the lost-connection notification
      this.wasConnected = false;
      // Detach shared-state callbacks so the dying client's close events
      // can't clobber the replacement client's connection bookkeeping
      oldClient.onConnect = () => {};
      oldClient.onDisconnect = () => {};
      oldClient.onWebSocketClose = () => {};
      oldClient.onWebSocketError = () => {};
      oldClient.onStompError = () => {};
      oldClient.deactivate().catch((error) => {
        warn('[WebSocket] Error deactivating previous client:', error);
      });
    }

    this.tokenProvider = provider;
    this.staticToken = isStatic ? (tokenOrProvider as string) : null;
    this.isConnecting = true;

    // Build WebSocket URL based on platform
    let wsUrl: string;

    if (Platform.OS === 'web') {
      // Web: Use SockJS endpoint with HTTP/HTTPS (SockJS handles upgrade)
      wsUrl = WEBSOCKET_CONFIG.SOCKJS_URL;
      wsUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    } else {
      // Native (iOS/Android): Use native WebSocket endpoint
      wsUrl = WEBSOCKET_CONFIG.URL;
      // Ensure ws:// or wss:// protocol
      if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
        wsUrl = wsUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      }
    }

    log('[WebSocket] Connecting to:', wsUrl);

    this.client = new Client({
      brokerURL: wsUrl,
      // No STOMP `debug` callback: it dumps entire frames, including the
      // Authorization header (bearer token) and full message payloads.
      // Exponential backoff: 3s -> 6s -> 12s ... capped at 60s so a down
      // server isn't hammered forever. stompjs resets the delay back to
      // reconnectDelay after every successful connect.
      reconnectDelay: WEBSOCKET_CONFIG.RECONNECT_INTERVAL,
      maxReconnectDelay: WEBSOCKET_CONFIG.MAX_RECONNECT_DELAY,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: WEBSOCKET_CONFIG.HEARTBEAT_INCOMING,
      heartbeatOutgoing: WEBSOCKET_CONFIG.HEARTBEAT_OUTGOING,

      // Runs before EVERY (re)connect attempt (initial and automatic
      // reconnects) — pull a fresh access token so reconnects after a token
      // rotation never present a stale JWT.
      beforeConnect: async (client: Client) => {
        try {
          const token = await this.tokenProvider?.();
          client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        } catch (error) {
          // Provider failed (e.g. refresh network error): keep the previous
          // headers and let this attempt play out; the next retry re-asks.
          logError('[WebSocket] Failed to obtain access token before connect:', error);
        }
      },

      // For web platform, use SockJS
      ...(Platform.OS === 'web' && {
        webSocketFactory: () => {
          // Dynamic import for web only
          const SockJS = require('sockjs-client');
          return new SockJS(wsUrl);
        },
      }),

      onConnect: () => {
        log('[WebSocket] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.wasConnected = true;
        this.resubscribeAll();
        this.onConnectedCallback?.();
      },

      // Fires only on graceful STOMP disconnect (client.deactivate()) —
      // NOT on network drops. Abrupt losses are handled by onWebSocketClose.
      onDisconnect: () => {
        log('[WebSocket] Disconnected (graceful)');
        this.isConnecting = false;
        if (this.wasConnected) {
          this.wasConnected = false;
          this.onDisconnectedCallback?.();
        }
      },

      // Fires on EVERY socket close, including abrupt network drops,
      // heartbeat timeouts and server restarts — the cases where the backend
      // auto-flips the courier OFFLINE. Guarded so repeated closes during a
      // reconnect loop only notify once per lost connection.
      onWebSocketClose: () => {
        this.isConnecting = false;
        if (this.wasConnected) {
          log('[WebSocket] Connection lost');
          this.wasConnected = false;
          this.onDisconnectedCallback?.();
        }
      },

      onStompError: (frame) => {
        const message = frame.headers['message'] || '';
        // The backend's WebSocketDestinationAuthorizer rejects unauthorized
        // SUBSCRIBE frames with a STOMP ERROR. Our subscriptions are all
        // within this courier's own scope, so a denial here means a bug or a
        // contract change — make it unmissable in production logs. The
        // connection closes after ERROR; exponential reconnect backoff
        // bounds any retry churn.
        if (/denied|forbidden|unauthori[sz]ed|access/i.test(message)) {
          logError('[WebSocket] SUBSCRIBE rejected by server authorizer:', message);
        } else {
          logError('[WebSocket] STOMP error:', message);
        }
        this.isConnecting = false;
        this.onErrorCallback?.(message || 'Connection error');
      },

      onWebSocketError: (event) => {
        logError('[WebSocket] WebSocket error:', event);
        this.isConnecting = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          this.onErrorCallback?.('Max reconnection attempts reached');
        }
      },
    });

    this.client.activate();
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.client) {
      log('[WebSocket] Disconnecting...');
      this.subscriptions.clear();
      // Intentional disconnect (logout/token change): suppress the
      // lost-connection notification so no re-assert or auto-offline fires
      this.wasConnected = false;
      this.client.deactivate().catch((error) => {
        warn('[WebSocket] Error during deactivate:', error);
      });
      this.client = null;
      this.tokenProvider = null;
      this.staticToken = null;
      this.isConnecting = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  // ── Order Topics ──

  /**
   * Subscribe to full order updates for a specific order (full OrderDto)
   */
  subscribeToOrderUpdates(
    orderId: string | number,
    handler: WebSocketMessageHandler<OrderDto>
  ): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.ORDER_UPDATES(orderId), handler);
  }

  /**
   * Subscribe to order-taken events for a specific order
   */
  subscribeToOrderTaken(
    orderId: string | number,
    handler: WebSocketMessageHandler<OrderTakenNotification>
  ): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.ORDER_TAKEN(orderId), handler);
  }

  // ── Notification Topics ──

  /**
   * Subscribe to personal user notifications
   */
  subscribeToUserNotifications(
    userId: string | number,
    handler: WebSocketMessageHandler<WebSocketNotification>
  ): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.USER_NOTIFICATIONS(userId), handler);
  }

  // ── Location Topics ──

  /**
   * Subscribe to location update confirmations for this courier (optional)
   */
  subscribeToLocationConfirmation(
    courierId: string | number,
    handler: WebSocketMessageHandler<LocationConfirmation>
  ): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.COURIER_LOCATION(courierId), handler);
  }

  /**
   * Generic subscribe method
   */
  private subscribe<T>(destination: string, handler: WebSocketMessageHandler<T>): () => void {
    // Store handler
    if (!this.messageHandlers.has(destination)) {
      this.messageHandlers.set(destination, new Set());
    }
    this.messageHandlers.get(destination)!.add(handler as WebSocketMessageHandler<unknown>);

    // If connected, subscribe immediately
    if (this.client?.connected && !this.subscriptions.has(destination)) {
      this.createSubscription(destination);
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(destination);
      if (handlers) {
        handlers.delete(handler as WebSocketMessageHandler<unknown>);

        // If no more handlers, unsubscribe from topic
        if (handlers.size === 0) {
          this.messageHandlers.delete(destination);
          const subInfo = this.subscriptions.get(destination);
          if (subInfo) {
            subInfo.subscription.unsubscribe();
            this.subscriptions.delete(destination);
          }
        }
      }
    };
  }

  /**
   * Create a STOMP subscription
   */
  private createSubscription(destination: string): void {
    if (!this.client?.connected) {
      return;
    }

    log('[WebSocket] Subscribing to:', destination);

    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        const handlers = this.messageHandlers.get(destination);
        handlers?.forEach((handler) => handler(body));
      } catch (error) {
        logError('[WebSocket] Failed to parse message:', error);
      }
    });

    this.subscriptions.set(destination, { destination, subscription });
  }

  /**
   * Resubscribe to all topics after reconnection
   */
  private resubscribeAll(): void {
    // Clear old subscriptions
    this.subscriptions.clear();

    // Recreate subscriptions for all registered handlers
    this.messageHandlers.forEach((_, destination) => {
      this.createSubscription(destination);
    });
  }

  /**
   * Set connection callbacks
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Send a message to a destination
   */
  send(destination: string, body: Record<string, unknown>): void {
    if (!this.client?.connected) {
      warn('[WebSocket] Cannot send message - not connected');
      return;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

export default websocketService;

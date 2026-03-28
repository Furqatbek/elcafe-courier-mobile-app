import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';
import { WEBSOCKET_CONFIG } from '@/constants/config';

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

interface SubscriptionInfo {
  destination: string;
  subscription: StompSubscription;
}

class WebSocketService {
  private client: Client | null = null;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private accessToken: string | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private messageHandlers: Map<string, Set<WebSocketMessageHandler<unknown>>> = new Map();

  // Event callbacks
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private onErrorCallback?: (error: string) => void;

  /**
   * Initialize WebSocket connection with authentication
   */
  connect(accessToken: string): void {
    if (this.isConnecting || (this.client?.connected && this.accessToken === accessToken)) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.accessToken = accessToken;
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

    console.log('[WebSocket] Connecting to:', wsUrl);

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      debug: (str) => {
        if (__DEV__) {
          console.log('[STOMP]', str);
        }
      },
      reconnectDelay: WEBSOCKET_CONFIG.RECONNECT_INTERVAL,
      heartbeatIncoming: WEBSOCKET_CONFIG.HEARTBEAT_INCOMING,
      heartbeatOutgoing: WEBSOCKET_CONFIG.HEARTBEAT_OUTGOING,

      // For web platform, use SockJS
      ...(Platform.OS === 'web' && {
        webSocketFactory: () => {
          // Dynamic import for web only
          const SockJS = require('sockjs-client');
          return new SockJS(wsUrl);
        },
      }),

      onConnect: () => {
        console.log('[WebSocket] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.resubscribeAll();
        this.onConnectedCallback?.();
      },

      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.onDisconnectedCallback?.();
      },

      onStompError: (frame) => {
        console.error('[WebSocket] STOMP error:', frame.headers['message']);
        this.isConnecting = false;
        this.onErrorCallback?.(frame.headers['message'] || 'Connection error');
      },

      onWebSocketError: (event) => {
        console.error('[WebSocket] WebSocket error:', event);
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
      console.log('[WebSocket] Disconnecting...');
      this.subscriptions.clear();
      this.client.deactivate();
      this.client = null;
      this.accessToken = null;
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
   * Subscribe to broadcast available orders (all couriers).
   * This channel sends both new order payloads and ORDER_TAKEN alerts.
   * Check message.type === 'ORDER_TAKEN' to distinguish.
   */
  subscribeToAvailableOrders(handler: WebSocketMessageHandler<AvailableOrdersChannelMessage>): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.AVAILABLE_ORDERS, handler);
  }

  /**
   * Subscribe to new orders targeted to this courier
   */
  subscribeToNewOrders(handler: WebSocketMessageHandler<NewOrderNotification>): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.NEW_ORDERS, handler);
  }

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
   * Subscribe to courier-role notifications (broadcast to all couriers)
   */
  subscribeToCourierNotifications(handler: WebSocketMessageHandler<WebSocketNotification>): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.COURIER_NOTIFICATIONS, handler);
  }

  /**
   * Subscribe to personal user notifications
   */
  subscribeToUserNotifications(
    userId: string | number,
    handler: WebSocketMessageHandler<WebSocketNotification>
  ): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.USER_NOTIFICATIONS(userId), handler);
  }

  /**
   * Subscribe to platform-wide broadcast notifications
   */
  subscribeToBroadcastNotifications(handler: WebSocketMessageHandler<WebSocketNotification>): () => void {
    return this.subscribe(WEBSOCKET_CONFIG.TOPICS.BROADCAST_NOTIFICATIONS, handler);
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

  // ── Deprecated (kept for backward compatibility) ──

  /** @deprecated Use subscribeToOrderUpdates instead */
  subscribeToOrderStatus(
    orderId: string | number,
    handler: WebSocketMessageHandler<OrderDto>
  ): () => void {
    return this.subscribeToOrderUpdates(orderId, handler);
  }

  /** @deprecated Use subscribeToUserNotifications instead */
  subscribeToNotifications(handler: WebSocketMessageHandler<WebSocketNotification>): () => void {
    const topic = WEBSOCKET_CONFIG.TOPICS.NOTIFICATIONS;
    return this.subscribe(topic, handler);
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

    console.log('[WebSocket] Subscribing to:', destination);

    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        const handlers = this.messageHandlers.get(destination);
        handlers?.forEach((handler) => handler(body));
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
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
      console.warn('[WebSocket] Cannot send message - not connected');
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

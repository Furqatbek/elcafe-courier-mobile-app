import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';
import { WEBSOCKET_CONFIG } from '@/constants/config';

// WebSocket message types
export interface NewOrderNotification {
  type: 'NEW_ORDER';
  orderId: number;
  orderNumber: string;
  restaurant: {
    name: string;
    distance: number;
  };
  deliveryDistance: number;
  estimatedEarnings: number;
  expiresAt: string;
}

export interface OrderStatusUpdate {
  orderId: number;
  status: string;
  updatedAt: string;
  message?: string;
}

export interface WebSocketNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
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

    // Build WebSocket URL
    let wsUrl = WEBSOCKET_CONFIG.URL;

    // For web, use SockJS endpoint
    // For native, use native WebSocket
    if (Platform.OS === 'web') {
      // SockJS will handle the connection
      wsUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    } else {
      // Native WebSocket - ensure ws:// or wss:// protocol
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

  /**
   * Subscribe to new orders channel
   */
  subscribeToNewOrders(handler: WebSocketMessageHandler<NewOrderNotification>): () => void {
    const topic = WEBSOCKET_CONFIG.TOPICS.NEW_ORDERS;
    return this.subscribe(topic, handler);
  }

  /**
   * Subscribe to order status updates for a specific order
   */
  subscribeToOrderStatus(
    orderId: string | number,
    handler: WebSocketMessageHandler<OrderStatusUpdate>
  ): () => void {
    const topic = WEBSOCKET_CONFIG.TOPICS.ORDER_STATUS(orderId);
    return this.subscribe(topic, handler);
  }

  /**
   * Subscribe to personal notifications
   */
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

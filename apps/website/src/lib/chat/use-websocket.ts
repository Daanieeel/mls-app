'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DeleteMessagePayload,
  Message,
  NewMessagePayload,
  UpdateMessagePayload,
  WebSocketEventType,
  WebSocketMessage,
} from './types';

const WEBSOCKET_URL = 'ws://localhost:3002/socket';
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseWebSocketOptions {
  onNewMessage?: (message: Message) => void;
  onUpdateMessage?: (payload: UpdateMessagePayload) => void;
  onDeleteMessage?: (payload: DeleteMessagePayload) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (chatId: string, content: string) => void;
  updateMessage: (messageId: string, chatId: string, content: string) => void;
  deleteMessage: (messageId: string, chatId: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { onNewMessage, onUpdateMessage, onDeleteMessage, onConnectionChange } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;

        switch (data.type) {
          case 'message:new': {
            const payload = data.payload as NewMessagePayload;
            onNewMessage?.(payload.message);
            break;
          }
          case 'message:update': {
            const payload = data.payload as UpdateMessagePayload;
            onUpdateMessage?.(payload);
            break;
          }
          case 'message:delete': {
            const payload = data.payload as DeleteMessagePayload;
            onDeleteMessage?.(payload);
            break;
          }
          case 'connection:established':
            console.log('[WebSocket] Connection established');
            break;
          default:
            console.log('[WebSocket] Unhandled event type:', data.type);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [onNewMessage, onUpdateMessage, onDeleteMessage],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WEBSOCKET_URL);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        onConnectionChange?.(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        onConnectionChange?.(false);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            console.log(
              `[WebSocket] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`,
            );
            connect();
          }, RECONNECT_INTERVAL);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onmessage = handleMessage;

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [handleMessage, onConnectionChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const sendWebSocketMessage = useCallback((type: WebSocketEventType, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: new Date(),
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: Not connected');
    }
  }, []);

  const sendMessage = useCallback(
    (chatId: string, content: string) => {
      sendWebSocketMessage('message:new', { chatId, content });
    },
    [sendWebSocketMessage],
  );

  const updateMessage = useCallback(
    (messageId: string, chatId: string, content: string) => {
      sendWebSocketMessage('message:update', { messageId, chatId, content });
    },
    [sendWebSocketMessage],
  );

  const deleteMessage = useCallback(
    (messageId: string, chatId: string) => {
      sendWebSocketMessage('message:delete', { messageId, chatId });
    },
    [sendWebSocketMessage],
  );

  return {
    isConnected,
    sendMessage,
    updateMessage,
    deleteMessage,
  };
}

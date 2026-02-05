'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import z from 'zod';
import type { MLSWebSocketMessage, WebSocketEventType, WebSocketMessage } from './types';
import { WebSocketMessageSchema } from './types';

const WEBSOCKET_URL = 'ws://localhost:3002/socket';
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseWebSocketOptions {
  onMessage?: (message: MLSWebSocketMessage) => void;
  onWelcome?: (groupId: string, payload: string) => void;
  onCommit?: (groupId: string, payload: string) => void;
  onApplicationMessage?: (
    messageId: string,
    groupId: string,
    senderId: string,
    payload: string,
    timestamp: Date,
    seqId?: number,
  ) => void;
  onTombstone?: (groupId: string, payload: string, messageId?: string) => void;
  onEdit?: (groupId: string, payload: string, messageId?: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (groupId: string, encryptedPayload: string, nonce?: string) => void;
  updateMessage: (groupId: string, messageId: string, encryptedPayload: string) => void;
  deleteMessage: (groupId: string, messageId: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onWelcome,
    onCommit,
    onApplicationMessage,
    onTombstone,
    onEdit,
    onConnectionChange,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const rawData = JSON.parse(event.data);
        const result = WebSocketMessageSchema.safeParse(rawData);

        if (!result.success) {
          console.error('[WebSocket] Invalid message format:', z.treeifyError(result.error));
          return;
        }

        const { data } = result;

        // Route to specific handlers based on event type
        switch (data.type) {
          case 'WELCOME':
            console.log('[WebSocket] Received WELCOME for group:', data.group_id);
            onMessage?.(data);
            onWelcome?.(data.group_id, data.payload);
            break;
          case 'COMMIT':
            console.log('[WebSocket] Received COMMIT for group:', data.group_id);
            onMessage?.(data);
            onCommit?.(data.group_id, data.payload);
            break;
          case 'MSG':
            console.log('[WebSocket] Received MSG for group:', data.group_id);
            onMessage?.(data);
            onApplicationMessage?.(
              data.message_id ?? 'unknown',
              data.group_id,
              data.sender_id ?? 'unknown',
              data.payload,
              data.timestamp ?? new Date(),
              data.seq_id,
            );
            break;
          case 'TOMBSTONE':
            console.log('[WebSocket] Received TOMBSTONE for group:', data.group_id);
            onMessage?.(data);
            onTombstone?.(data.group_id, data.payload, data.message_id);
            break;
          case 'EDIT':
            console.log('[WebSocket] Received EDIT for group:', data.group_id);
            onMessage?.(data);
            onEdit?.(data.group_id, data.payload, data.message_id);
            break;
          case 'connection:established':
            console.log('[WebSocket] Connection established');
            break;
          case 'connection:error':
            console.error('[WebSocket] Connection error event received');
            break;
          default: {
            const exhaustiveCheck: never = data;
            console.warn('[WebSocket] Unhandled event type:', exhaustiveCheck);
          }
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [onMessage, onWelcome, onCommit, onApplicationMessage, onTombstone, onEdit],
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

  const sendWebSocketMessage = useCallback(
    (
      type: WebSocketEventType,
      groupId: string,
      payload: string,
      extras?: { nonce?: string; message_id?: string },
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message: WebSocketMessage = {
          type,
          group_id: groupId,
          payload,
          timestamp: new Date(),
          ...extras,
        };
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[WebSocket] Cannot send message: Not connected');
      }
    },
    [],
  );

  const sendMessage = useCallback(
    (groupId: string, encryptedPayload: string, nonce?: string) => {
      sendWebSocketMessage('MSG', groupId, encryptedPayload, nonce ? { nonce } : undefined);
    },
    [sendWebSocketMessage],
  );

  const updateMessage = useCallback(
    (groupId: string, messageId: string, encryptedPayload: string) => {
      sendWebSocketMessage('EDIT', groupId, encryptedPayload, {
        message_id: messageId,
      });
    },
    [sendWebSocketMessage],
  );

  const deleteMessage = useCallback(
    (groupId: string, messageId: string) => {
      // For delete, payload might be an encrypted reference or just empty
      sendWebSocketMessage('TOMBSTONE', groupId, '', { message_id: messageId });
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

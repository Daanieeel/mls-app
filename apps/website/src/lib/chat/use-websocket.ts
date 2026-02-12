'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import z from 'zod';
import type { MLSWebSocketMessage } from './types';
import { WebSocketMessageSchema } from './types';

const WEBSOCKET_URL = 'ws://localhost:3002/socket';
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface SystemEventMeta {
  cloudEventType?: string;
  actorName?: string;
  targetName?: string;
  targetId?: string;
}

interface UseWebSocketOptions {
  accessToken: string | null;
  onMessage?: (message: MLSWebSocketMessage) => void;
  onWelcome?: (groupId: string, payload: string, meta?: SystemEventMeta) => void;
  onCommit?: (groupId: string, payload: string, meta?: SystemEventMeta) => void;
  onApplicationMessage?: (
    messageId: string,
    groupId: string,
    senderId: string,
    payload: string,
    timestamp: Date,
    seqId?: number,
  ) => void;
  onTombstone?: (groupId: string, payload: string, messageId?: string, senderId?: string) => void;
  onEdit?: (groupId: string, payload: string, messageId?: string, senderId?: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    accessToken,
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
  const accessTokenRef = useRef(accessToken);
  const intentionalCloseRef = useRef(false);

  // Keep the token ref up to date without causing reconnections
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Store callbacks in refs to avoid recreating connect on every render
  const onMessageRef = useRef(onMessage);
  const onWelcomeRef = useRef(onWelcome);
  const onCommitRef = useRef(onCommit);
  const onApplicationMessageRef = useRef(onApplicationMessage);
  const onTombstoneRef = useRef(onTombstone);
  const onEditRef = useRef(onEdit);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onWelcomeRef.current = onWelcome;
    onCommitRef.current = onCommit;
    onApplicationMessageRef.current = onApplicationMessage;
    onTombstoneRef.current = onTombstone;
    onEditRef.current = onEdit;
    onConnectionChangeRef.current = onConnectionChange;
  }, [
    onMessage,
    onWelcome,
    onCommit,
    onApplicationMessage,
    onTombstone,
    onEdit,
    onConnectionChange,
  ]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const rawData = JSON.parse(event.data);
      console.log('[WebSocket] Received raw message:', rawData);

      const result = WebSocketMessageSchema.safeParse(rawData);

      if (!result.success) {
        console.error('[WebSocket] Invalid message format:', z.treeifyError(result.error));
        console.error('[WebSocket] Raw data that failed validation:', rawData);
        return;
      }

      const { data } = result;
      console.log('[WebSocket] Parsed and validated message:', data);

      // Route to specific handlers based on event type
      switch (data.type) {
        case 'WELCOME':
          console.log('[WebSocket] Received WELCOME for group:', data.group_id);
          onMessageRef.current?.(data);
          onWelcomeRef.current?.(data.group_id, data.payload, {
            cloudEventType: data.cloud_event_type,
            actorName: data.actor_name,
            targetName: data.target_name,
            targetId: data.target_id,
          });
          break;
        case 'COMMIT':
          console.log('[WebSocket] Received COMMIT for group:', data.group_id);
          onMessageRef.current?.(data);
          onCommitRef.current?.(data.group_id, data.payload, {
            cloudEventType: data.cloud_event_type,
            actorName: data.actor_name,
            targetName: data.target_name,
            targetId: data.target_id,
          });
          break;
        case 'MSG':
          console.log('[WebSocket] Received MSG for group:', data.group_id);
          onMessageRef.current?.(data);
          onApplicationMessageRef.current?.(
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
          onMessageRef.current?.(data);
          onTombstoneRef.current?.(
            data.group_id,
            data.payload,
            data.message_id,
            data.sender_id ?? undefined,
          );
          break;
        case 'EDIT':
          console.log('[WebSocket] Received EDIT for group:', data.group_id);
          onMessageRef.current?.(data);
          onEditRef.current?.(
            data.group_id,
            data.payload,
            data.message_id,
            data.sender_id ?? undefined,
          );
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
  }, []);

  // Single stable effect to manage the WebSocket lifecycle
  useEffect(() => {
    if (!accessToken) {
      console.warn('[WebSocket] No access token available, skipping connection');
      return;
    }

    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;

    function connect() {
      if (intentionalCloseRef.current) return;

      const token = accessTokenRef.current;
      if (!token) return;

      // Close any existing connection first
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        const url = `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('[WebSocket] Connected');
          setIsConnected(true);
          onConnectionChangeRef.current?.(true);
          reconnectAttemptsRef.current = 0;
        };

        ws.onclose = () => {
          if (intentionalCloseRef.current) return;
          console.log('[WebSocket] Disconnected');
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);

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

        ws.onerror = () => {
          // Suppress errors from intentional teardowns (e.g. React Strict Mode)
          if (intentionalCloseRef.current) return;
          console.error('[WebSocket] Connection error');
        };

        ws.onmessage = handleMessage;

        wsRef.current = ws;
      } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
      }
    }

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [accessToken, handleMessage]);

  return {
    isConnected,
  };
}

import { env } from '@repo/env';
import { Elysia, t } from 'elysia';
import { authenticateWebSocket, type AuthUser } from './auth';
import { WebSocketModel } from './model';
import { createSubscriber } from './utils/redis';
import type { RedisClientType } from 'redis';

const CLOUD_EVENT_TYPE_NOTIFICATION = 'de.messenger.message.notification.published';

const PORT = env.PORT_WEBSOCKET;

// Store per-connection Redis subscribers keyed by a unique connection identifier
const subscriberMap = new Map<string, RedisClientType>();

const app = new Elysia({ prefix: '/socket', websocket: { idleTimeout: undefined } })
  .derive(async ({ query }) => {
    // Extract token from query parameter
    const token = query.token;
    const auth = await authenticateWebSocket(token);

    return {
      auth,
    };
  })
  .ws('/', {
    query: t.Object({
      token: t.String({ error: 'Authentication token is required' }),
    }),
    body: WebSocketModel.MessageBody,

    // Guard: reject connection if not authenticated
    beforeHandle({ auth, error }) {
      if (!auth.isAuthenticated || !auth.user) {
        return error(401, {
          error: 'Unauthorized',
          message: auth.error || 'Authentication required',
        });
      }
    },

    message(ws, message) {
      const user = ws.data.auth.user as AuthUser;
      ws.send({ type: 'RECEIVED', message, userId: user.id });
    },

    async open(ws) {
      const user = ws.data.auth.user as AuthUser;
      const connectionKey = `${user.id}:${ws.id}`;
      console.log(`[WebSocket] Connection opened for user: ${user.id} (${user.email})`);

      try {
        const subscriber = await createSubscriber();
        subscriberMap.set(connectionKey, subscriber);

        const redisChannel = `inbox:${user.id}`;
        console.log(`[WebSocket] Subscribing to Redis channel: ${redisChannel}`);

        await subscriber.subscribe(redisChannel, (message: string) => {
          try {
            console.log(
              `[WebSocket] Received message from Redis for user ${user.id}:`,
              message.substring(0, 200),
            );
            const cloudEvent = JSON.parse(message);

            // The worker publishes CloudEvents — unwrap to get the inbox item data
            if (cloudEvent.type === CLOUD_EVENT_TYPE_NOTIFICATION && cloudEvent.data) {
              const inboxItem = cloudEvent.data as {
                type: string;
                nonce: string;
                group_id: string;
                payload: string | Record<string, unknown>;
                seq_id: number;
                message_id: string | null;
                sender_id: string | null;
                receiver_id: string;
                timestamp: string;
                cloud_event_type?: string;
                actor_name?: string;
                target_name?: string;
                target_id?: string;
              };

              // Ensure the payload is always a string.
              // It should already be a string from the worker, but handle edge cases.
              let payloadStr: string;
              if (typeof inboxItem.payload === 'string') {
                payloadStr = inboxItem.payload;
              } else if (
                typeof inboxItem.payload === 'object' &&
                inboxItem.payload !== null &&
                'type' in inboxItem.payload &&
                inboxItem.payload.type === 'Buffer' &&
                'data' in inboxItem.payload &&
                Array.isArray(inboxItem.payload.data)
              ) {
                // Handle the case where JSON serialization produced {type:'Buffer', data:[...]}
                payloadStr = Buffer.from(inboxItem.payload.data as number[]).toString('utf-8');
                console.warn(
                  '[WebSocket] Payload was a serialized Buffer object — converted to string',
                );
              } else {
                payloadStr = String(inboxItem.payload);
                console.warn(`[WebSocket] Unexpected payload type: ${typeof inboxItem.payload}`);
              }

              console.log(
                `[WebSocket] Processing notification type=${inboxItem.type} messageId=${inboxItem.message_id ?? 'none'} payloadLength=${payloadStr.length} payloadPreview=${payloadStr.substring(0, 80)}`,
              );

              // Forward the inbox item in the format the client expects:
              // { type, group_id, payload, message_id, sender_id, timestamp, seq_id }
              const wsMessage = {
                type: inboxItem.type,
                group_id: cloudEvent.subject as string,
                payload: payloadStr,
                message_id: inboxItem.message_id,
                sender_id: inboxItem.sender_id,
                seq_id: inboxItem.seq_id,
                timestamp: inboxItem.timestamp,
                // System event metadata for UI notifications
                cloud_event_type: inboxItem.cloud_event_type,
                actor_name: inboxItem.actor_name,
                target_name: inboxItem.target_name,
                target_id: inboxItem.target_id,
              };
              console.log(
                '[WebSocket] Sending to client:',
                JSON.stringify(wsMessage).substring(0, 300),
              );
              ws.send(wsMessage);
            } else {
              console.log('[WebSocket] Forwarding non-notification message:', cloudEvent);
              // Forward other messages as-is
              ws.send(cloudEvent);
            }
          } catch (err) {
            console.error(`[WebSocket] Failed to process Redis message for user ${user.id}:`, err);
          }
        });

        console.log(`[WebSocket] Successfully subscribed to ${redisChannel}`);
      } catch (err) {
        console.error(`[WebSocket] Failed to set up Redis subscriber for user ${user.id}:`, err);
      }
    },

    async close(ws) {
      const user = ws.data.auth.user as AuthUser;
      const connectionKey = `${user.id}:${ws.id}`;
      console.log(`WebSocket connection closed for user: ${user.id}`);

      const subscriber = subscriberMap.get(connectionKey);
      if (subscriber) {
        subscriberMap.delete(connectionKey);
        try {
          await subscriber.unsubscribe(`inbox:${user.id}`);
          await subscriber.disconnect();
        } catch {
          // Connection may already be closed
        }
      }
    },
  })
  .listen(PORT);

export type App = typeof app;

console.log(
  `🦊 Elysia WebSocket is running at http://${app.server?.hostname}:${app.server?.port}/socket`,
);

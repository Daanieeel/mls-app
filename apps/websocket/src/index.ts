import { env } from '@repo/env';
import { Elysia, t } from 'elysia';
import { authenticateWebSocket, type AuthUser } from './auth';
import { WebSocketModel } from './model';
import { redisPlugin } from './utils/redis';

const PORT = env.PORT_WEBSOCKET;

const app = new Elysia({ prefix: '/socket', websocket: { idleTimeout: undefined } })
  .use(redisPlugin())
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

    open(ws) {
      const user = ws.data.auth.user as AuthUser;
      console.log(`WebSocket connection opened for user: ${user.id} (${user.email})`);
      ws.send({
        type: 'WELCOME',
        payload: 'Welcome',
        userId: user.id,
      });
    },

    close(ws) {
      const user = ws.data.auth.user as AuthUser;
      console.log(`WebSocket connection closed for user: ${user.id}`);
    },
  })
  .listen(PORT);

export type App = typeof app;

console.log(
  `🦊 Elysia WebSocket is running at http://${app.server?.hostname}:${app.server?.port}/socket`,
);

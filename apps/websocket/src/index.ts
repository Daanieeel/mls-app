import { env } from '@repo/env';
import { Elysia, t } from 'elysia';
import { WebSocketModel } from './model';

const PORT = env.PORT_WEBSOCKET;

const app = new Elysia({ prefix: '/socket', websocket: { idleTimeout: undefined } })
  .ws('/', {
    body: WebSocketModel.MessageBody,
    message(ws, message) {
      ws.send({ type: 'RECEIVED', message });
    },
    open(ws) {
      console.log('WebSocket connection opened');
      ws.send({
        type: 'WELCOME',
        payload: 'Welcome',
      });
    },
    close(ws) {
      console.log('WebSocket connection closed');
      ws.send({
        type: 'EXIT',
        payload: 'Goodbye',
      });
    },
  })
  .listen(PORT);

export type App = typeof app;

console.log(
  `🦊 Elysia WebSocket is running at http://${app.server?.hostname}:${app.server?.port}/socket`,
);

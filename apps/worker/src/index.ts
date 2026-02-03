import { env } from '@repo/env';
import { Elysia } from 'elysia';

const PORT = env.PORT_WORKER;

const app = new Elysia({ prefix: '/elysia' })
  .get('/', () => 'Hi Elysia')
  .get('/hello_world', () => 'Hello World')
  .listen(PORT);

export type App = typeof app;

console.log(`🦊 Elysia Worker is running at http://${app.server?.hostname}:${app.server?.port}`);

import { env } from '@repo/env';
import { Elysia } from 'elysia';
import { groupRouter } from './group/index';
import { kafkaPlugin } from './kafka';

const PORT = env.PORT_REST;

const app = new Elysia().use(groupRouter).listen(PORT);

export type App = typeof app;

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

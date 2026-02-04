import { env } from '@repo/env';
import { Elysia } from 'elysia';
import { createClient } from 'redis';

const subscriber = createClient({
  url: env.REDIS_URL,
});

export const redisPlugin = async () => {
  await subscriber.connect();

  return new Elysia({ name: 'subscriber' }).decorate('subscriber', subscriber).onStop(async () => {
    await subscriber.destroy();
  });
};

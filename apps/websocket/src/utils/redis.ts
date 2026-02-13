import { env } from '@repo/env';
import { Elysia } from 'elysia';
import { createClient, type RedisClientType } from 'redis';

/**
 * Creates a new connected Redis subscriber client.
 * Each WebSocket connection should use its own subscriber
 * since a Redis client in subscriber mode can only do SUBSCRIBE/UNSUBSCRIBE.
 */
export async function createSubscriber(): Promise<RedisClientType> {
  const subscriber = createClient({ url: env.REDIS_URL }) as RedisClientType;
  await subscriber.connect();
  return subscriber;
}

export const redisPlugin = () => {
  return new Elysia({ name: 'redis-plugin' });
};

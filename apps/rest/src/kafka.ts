// kafka.ts
import { Kafka } from 'kafkajs';
import { Elysia } from 'elysia';
import { env } from '@repo/env';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID_REST,
  brokers: [...env.KAFKA_BROKERS.split(',')],
});

export const kafkaPlugin = async () => {
  const producer = kafka.producer();
  await producer.connect();

  return new Elysia({ name: 'kafka' }).decorate('producer', producer).onStop(async () => {
    await producer.disconnect();
  });
};

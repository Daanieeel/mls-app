import { env } from '@repo/env';
import { Elysia } from 'elysia';
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-elysia-app',
  brokers: [...env.KAFKA_BROKERS.split(',')],
});

export const kafkaPlugin = async () => {
  const producer = kafka.producer();
  await producer.connect();

  return new Elysia({ name: 'kafka' }).decorate('producer', producer).onStop(async () => {
    await producer.disconnect();
  });
};

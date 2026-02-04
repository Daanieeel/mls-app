import { Kafka } from 'kafkajs';
import { env } from '@repo/env';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID_WORKER,
  brokers: env.KAFKA_BROKERS.split(','),
});

const consumer = kafka.consumer({
  groupId: env.KAFKA_GROUP_ID_WORKER,
});

async function run() {
  await consumer.connect();
  consumer.subscribe({
    topics: ['message-events'],
  });
}

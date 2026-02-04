import { Kafka } from 'kafkajs';
import { env } from '@repo/env';
import { KAFKA_TOPIC_TYPES } from '@repo/utils';

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
    topics: Object.values(KAFKA_TOPIC_TYPES),
  });
}

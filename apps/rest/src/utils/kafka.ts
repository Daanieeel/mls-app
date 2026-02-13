import { env } from '@repo/env';
import { KAFKA_TOPIC_TYPES } from '@repo/utils';
import { Elysia } from 'elysia';
import { Kafka, type Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID_REST,
  brokers: env.KAFKA_BROKERS.split(',').filter(Boolean),
  enforceRequestTimeout: false,
  requestTimeout: 30000,
  connectionTimeout: 10000,
});

let producerInstance: Producer | null = null;

export const initKafka = async () => {
  if (producerInstance) {
    return producerInstance;
  }

  try {
    // Ensure topics exist before producing
    const admin = kafka.admin();
    await admin.connect();
    const topics = Object.values(KAFKA_TOPIC_TYPES);

    try {
      await admin.createTopics({
        validateOnly: false,
        topics: topics.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
      });
    } catch (error: any) {
      // Topics might already exist, which is fine
      if (!error?.message?.includes('already exists')) {
        console.warn('[Kafka] Topic creation warning:', error?.message);
      }
    }

    await admin.disconnect();

    const producer = kafka.producer();
    await producer.connect();
    producerInstance = producer;

    console.log('[Kafka] Producer initialized successfully');
    return producer;
  } catch (error) {
    console.error('[Kafka] Failed to initialize producer:', error);
    throw error;
  }
};

export const kafkaPlugin = () => {
  return new Elysia({ name: 'kafka' })
    .decorate('producer', producerInstance as Producer)
    .onStop(async () => {
      if (producerInstance) {
        await producerInstance.disconnect();
        producerInstance = null;
      }
    });
};

import { Kafka } from 'kafkajs';
import { env } from '@repo/env';
import { CLOUD_EVENT_TYPES, type CloudEventType, KAFKA_TOPIC_TYPES } from '@repo/utils';
import { CloudEvent } from 'cloudevents';
import { prisma } from '@repo/database';
import { createClient } from 'redis';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID_WORKER,
  brokers: env.KAFKA_BROKERS.split(','),
});

const publisher = createClient({
  url: env.REDIS_URL,
});

const consumer = kafka.consumer({
  groupId: env.KAFKA_GROUP_ID_WORKER,
});

async function run() {
  await consumer.connect();
  await publisher.connect();
  consumer.subscribe({
    topics: Object.values(KAFKA_TOPIC_TYPES),
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const cloudEventString = message.value.toString();
      const cloudEvent = JSON.parse(cloudEventString) as CloudEvent<{
        type: CloudEventType;
        payload: string;
        nonce: string;
        id: string;
      }>;

      if (!cloudEvent.data) {
        return;
      }

      const groupId = cloudEvent.subject;

      const group = await prisma.group.findUnique({
        where: {
          id: groupId,
        },
        include: {
          members: {
            select: {
              userId: true,
            },
          },
        },
      });

      const members = group?.members || [];

      type PreparedInboxItem = {
        type: string;
        nonce: string;
        payload: Uint8Array<ArrayBuffer>;
        receiver: {
          connect: {
            id: string;
          };
        };
        message: {
          connect: {
            id: string;
          };
        };
        messageId: string;
        receiverId: string;
        seq_id: number;
      };

      const preparedInboxItems: PreparedInboxItem[] = [];

      for (const currentMember of members) {
        const temp: PreparedInboxItem = {
          ...cloudEvent.data,
          receiver: {
            connect: {
              id: currentMember.userId,
            },
          },
          message: {
            connect: {
              id: cloudEvent.data.id,
            },
          },
          payload: Buffer.from(cloudEvent.data.payload),
          messageId: cloudEvent.data.id,
          receiverId: currentMember.userId,
          seq_id: 123,
        };

        preparedInboxItems.push(temp);
      }

      const inboxItems = await prisma.userInboxItem.createManyAndReturn({
        data: preparedInboxItems,
      });

      for (const currentItem of inboxItems) {
        const inboxCloudEvent = new CloudEvent({
          specversion: '1.0',
          type: CLOUD_EVENT_TYPES.MESSAGE_NOTIFICATION_PUBLISHED,
          source: 'worker:eachMessage',
          time: new Date().toISOString(),
          subject: groupId,
          data: currentItem,
        });

        publisher.publish(`inbox:${currentItem.receiverId}`, JSON.stringify(inboxCloudEvent));
      }
    },
  });
}

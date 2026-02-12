import { Kafka } from 'kafkajs';
import { env } from '@repo/env';
import { CLOUD_EVENT_TYPES, type CloudEventType, KAFKA_TOPIC_TYPES } from '@repo/utils';
import { CloudEvent } from 'cloudevents';
import { prisma } from '@repo/database';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID_WORKER,
  brokers: env.KAFKA_BROKERS.split(',').filter(Boolean),
  enforceRequestTimeout: false,
  requestTimeout: 30000,
  connectionTimeout: 10000,
});

const publisher = createClient({
  url: env.REDIS_URL,
});

const admin = kafka.admin();
const consumer = kafka.consumer({
  groupId: env.KAFKA_GROUP_ID_WORKER,
  retry: {
    retries: 10,
    initialRetryTime: 1000,
  },
});

async function run() {
  console.log('[Worker] Starting worker...');
  console.log(`[Worker] Kafka client: ${env.KAFKA_CLIENT_ID_WORKER}`);
  console.log(`[Worker] Kafka group: ${env.KAFKA_GROUP_ID_WORKER}`);

  // Ensure topics exist before subscribing
  await admin.connect();
  const topics = Object.values(KAFKA_TOPIC_TYPES);
  await admin.createTopics({
    waitForLeaders: true,
    topics: topics.map((topic) => ({ topic, numPartitions: 3 })),
  });
  await admin.disconnect();
  console.log(`[Worker] Ensured topics exist: ${topics.join(', ')}`);

  await consumer.connect();
  console.log('[Worker] Kafka consumer connected');

  await publisher.connect();
  console.log('[Worker] Redis publisher connected');

  await consumer.subscribe({
    topics,
    fromBeginning: true,
  });
  console.log(`[Worker] Subscribed to topics: ${topics.join(', ')} (fromBeginning: true)`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(
        `[Worker] Received message on topic=${topic} partition=${partition} offset=${message.offset}`,
      );

      if (!message.value) {
        console.warn(`[Worker] Empty message on topic=${topic} partition=${partition}, skipping`);
        return;
      }

      const cloudEventString = message.value.toString();
      console.log('[Worker] Raw CloudEvent (first 300 chars):', cloudEventString.substring(0, 300));

      const cloudEvent = JSON.parse(cloudEventString) as CloudEvent<{
        type: CloudEventType;
        payload: string;
        nonce: string;
        id: string;
        senderId?: string;
        actorName?: string;
        targetName?: string;
        targetId?: string;
      }>;

      console.log('[Worker] Parsed CloudEvent data payload info:', {
        hasData: !!cloudEvent.data,
        cloudEventType: cloudEvent.type,
        payloadType: typeof cloudEvent.data?.payload,
        payloadLength: cloudEvent.data?.payload?.length ?? 0,
        payloadPreview: String(cloudEvent.data?.payload ?? '').substring(0, 80),
        type: cloudEvent.data?.type,
        senderId: cloudEvent.data?.senderId,
        actorName: cloudEvent.data?.actorName,
        targetName: cloudEvent.data?.targetName,
      });

      if (!cloudEvent.data) {
        console.warn(`[Worker] CloudEvent has no data, skipping (type=${cloudEvent.type})`);
        return;
      }

      const groupId = cloudEvent.subject;
      console.log(
        `[Worker] Processing event: cloudEventType=${cloudEvent.type} messageType=${cloudEvent.data.type} group=${groupId} messageId=${cloudEvent.data.id}`,
      );

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

      if (!group) {
        console.error(`[Worker] Group not found: ${groupId}`);
        return;
      }

      const members = group.members;
      console.log(`[Worker] Group "${group.name}" has ${members.length} member(s)`);

      // For GROUP_USER_REMOVED events, the removed user is no longer in the
      // members list but still needs to receive the system notification.
      // Build a deduplicated list of recipient user IDs.
      const recipientIds = new Set(members.map((m) => m.userId));
      if (cloudEvent.type === CLOUD_EVENT_TYPES.GROUP_USER_REMOVED && cloudEvent.data.targetId) {
        recipientIds.add(cloudEvent.data.targetId);
        console.log(
          `[Worker] Added removed user ${cloudEvent.data.targetId} as extra recipient for GROUP_USER_REMOVED`,
        );
      }

      type PreparedInboxItem = {
        type: string;
        nonce: string;
        payload: Uint8Array<ArrayBuffer>;
        messageId?: string; // Optional for WELCOME messages
        receiverId: string;
        groupId: string;
        senderId?: string;
        seq_id: number;
      };

      // Determine the inbox item type based on the CloudEvent type.
      // MESSAGE_UPDATED → EDIT, MESSAGE_DELETED → TOMBSTONE, otherwise use the original type.
      let inboxItemType: string = cloudEvent.data.type;
      if (cloudEvent.type === CLOUD_EVENT_TYPES.MESSAGE_UPDATED) {
        inboxItemType = 'EDIT';
      } else if (cloudEvent.type === CLOUD_EVENT_TYPES.MESSAGE_DELETED) {
        inboxItemType = 'TOMBSTONE';
      }

      const preparedInboxItems: PreparedInboxItem[] = [];

      for (const recipientId of recipientIds) {
        // Store the payload string as UTF-8 bytes in Prisma's Bytes field.
        const payloadBuffer = Buffer.from(cloudEvent.data.payload, 'utf-8');
        const temp: PreparedInboxItem = {
          type: inboxItemType,
          nonce: randomUUID(), // Generate unique nonce for each inbox item
          payload: payloadBuffer,
          // For TOMBSTONE events, don't set messageId since the message is already deleted from DB
          messageId: inboxItemType === 'TOMBSTONE' ? undefined : cloudEvent.data.id || undefined,
          receiverId: recipientId,
          groupId: groupId ?? '', // Store group ID directly for sync
          senderId: cloudEvent.data.senderId || undefined, // Store sender ID for sync
          seq_id: 123,
        };

        preparedInboxItems.push(temp);
      }

      console.log(`[Worker] Creating ${preparedInboxItems.length} inbox item(s)`);

      const inboxItems = await prisma.userInboxItem.createManyAndReturn({
        data: preparedInboxItems,
      });

      console.log(`[Worker] Created ${inboxItems.length} inbox item(s), publishing to Redis`);

      for (const currentItem of inboxItems) {
        // CRITICAL FIX: Reconstruct the original payload string from Prisma's Bytes.
        // Previously this used .toString('base64') which DOUBLE-encoded the payload,
        // because the bytes already represent a base64 string stored as UTF-8.
        // Use .toString('utf-8') to get back the original string.
        const payloadString = Buffer.from(currentItem.payload).toString('utf-8');

        console.log('[Worker] Publishing inbox item to Redis:', {
          receiverId: currentItem.receiverId,
          type: currentItem.type,
          messageId: currentItem.messageId ?? 'none',
          payloadLength: payloadString.length,
          payloadPreview: payloadString.substring(0, 80),
        });

        const inboxCloudEvent = new CloudEvent({
          specversion: '1.0',
          type: CLOUD_EVENT_TYPES.MESSAGE_NOTIFICATION_PUBLISHED,
          source: 'worker:eachMessage',
          time: new Date().toISOString(),
          subject: groupId,
          data: {
            type: currentItem.type,
            nonce: currentItem.nonce,
            group_id: groupId,
            payload: payloadString,
            seq_id: Number(currentItem.seq_id),
            // For TOMBSTONE/EDIT, use the original message ID from CloudEvent since
            // it's not stored in DB due to FK constraint (message is already deleted)
            message_id:
              currentItem.type === 'TOMBSTONE' || currentItem.type === 'EDIT'
                ? cloudEvent.data.id
                : currentItem.messageId,
            sender_id: cloudEvent.data.senderId,
            receiver_id: currentItem.receiverId,
            timestamp: currentItem.createdAt,
            // Pass through system event metadata for UI notifications
            cloud_event_type: cloudEvent.type,
            actor_name: cloudEvent.data.actorName,
            target_name: cloudEvent.data.targetName,
            target_id: cloudEvent.data.targetId,
          },
        });

        await publisher.publish(`inbox:${currentItem.receiverId}`, JSON.stringify(inboxCloudEvent));
        console.log(
          `[Worker] Published to inbox:${currentItem.receiverId} type=${currentItem.type} messageId=${currentItem.messageId || 'none'}`,
        );
      }

      console.log(
        `[Worker] Done processing event: messageId=${cloudEvent.data.id} → ${inboxItems.length} notification(s) sent`,
      );
    },
  });

  console.log('[Worker] Running and waiting for messages...');
}

run();

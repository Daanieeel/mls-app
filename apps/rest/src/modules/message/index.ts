import { Elysia } from 'elysia';
import { requireAuth } from '../auth/guard';
import { MessageModel } from './model';
import { MessageService } from './service';
import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';
import { prisma } from '@repo/database';
import { kafkaPlugin } from '../../utils/kafka';

export const messageRouter = new Elysia({ prefix: '/messages' })
  .use(requireAuth)
  .use(kafkaPlugin())
  .post(
    '/',
    async ({ body, user, set, producer }) => {
      // Verify the sender is a member of the target group
      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: body.groupId,
          },
        },
      });
      if (!membership) {
        set.status = 403;
        return { error: 'Forbidden', message: 'You are not a member of this group' };
      }

      const createdCloudEvent: MinimalCloudEvent = await MessageService.createMessage({
        body,
        userId: user.id,
      });

      console.log('[REST] Sending message to Kafka:', {
        topic: KAFKA_TOPIC_TYPES.MESSAGE,
        groupId: body.groupId,
        messageId: createdCloudEvent.id,
      });

      const result = await producer.send({
        topic: KAFKA_TOPIC_TYPES.MESSAGE,
        messages: [
          {
            key: body.groupId,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });

      console.log('[REST] Message sent to Kafka successfully:', result);

      set.status = 202;
      return createdCloudEvent;
    },
    { body: MessageModel.CreateMessageBody },
  )

  .patch(
    '/:id',
    async ({ body, params, user, set, producer }) => {
      try {
        console.log('[REST] PATCH /messages/:id called', {
          messageId: params.id,
          userId: user.id,
          bodyType: body.type,
          groupId: body.groupId,
        });

        const createdCloudEvent: MinimalCloudEvent = await MessageService.updateMessage({
          body,
          params,
          userId: user.id,
        });

        console.log('[REST] updateMessage succeeded, sending to Kafka', {
          cloudEventType: createdCloudEvent.type,
          subject: createdCloudEvent.subject,
        });

        await producer.send({
          topic: KAFKA_TOPIC_TYPES.MESSAGE,
          messages: [
            {
              key: createdCloudEvent.subject,
              value: JSON.stringify(createdCloudEvent),
            },
          ],
        });

        console.log('[REST] Edit CloudEvent sent to Kafka successfully');

        set.status = 202;
        return createdCloudEvent;
      } catch (err) {
        console.error('[REST] PATCH /messages/:id error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'Message not found') {
          set.status = 404;
          return { error: 'Not Found', message };
        }
        if (message === 'You can only edit your own messages') {
          set.status = 403;
          return { error: 'Forbidden', message };
        }
        throw err;
      }
    },
    {
      body: MessageModel.UpdateMessageBody,
      params: MessageModel.UpdateMessageParams,
    },
  )

  .delete(
    '/:id',
    async ({ params, user, set, producer }) => {
      try {
        const createdCloudEvent = await MessageService.deleteMessage({
          params,
          userId: user.id,
        });

        await producer.send({
          topic: KAFKA_TOPIC_TYPES.MESSAGE,
          messages: [
            {
              key: createdCloudEvent.subject,
              value: JSON.stringify(createdCloudEvent),
            },
          ],
        });

        set.status = 202;
        return createdCloudEvent;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'Message not found') {
          set.status = 404;
          return { error: 'Not Found', message };
        }
        if (message === 'You can only delete your own messages') {
          set.status = 403;
          return { error: 'Forbidden', message };
        }
        throw err;
      }
    },
    {
      params: MessageModel.DeleteMessageParams,
    },
  );

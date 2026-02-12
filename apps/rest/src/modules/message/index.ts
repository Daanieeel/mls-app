import { Elysia } from 'elysia';
import { requireAuth } from '../auth/guard';
import { MessageModel } from './model';
import { MessageService } from './service';
import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';
import { prisma } from '@repo/database';

export const messageRouter = new Elysia({ prefix: '/messages' })
  .use(requireAuth)
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

  .use(requireAuth)
  .patch(
    '/:id',
    async ({ body, params, user, set, producer }) => {
      const createdCloudEvent: MinimalCloudEvent = await MessageService.updateMessage({
        body,
        params,
        userId: user.id,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.MESSAGE,
        messages: [
          {
            key: createdCloudEvent.subject,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });
      // TODO: Error() => undefined
      if (createdCloudEvent === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return createdCloudEvent;
    },
    {
      body: MessageModel.UpdateMessageBody,
    },
  )

  .delete(
    '/:id',
    async ({ params, set, producer }) => {
      const createdCloudEvent = await MessageService.deleteMessage({
        params: params,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.MESSAGE,
        messages: [
          {
            key: createdCloudEvent.subject,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });

      // TODO: Error() => undefined
      if (createdCloudEvent === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return createdCloudEvent;
    },
    {
      params: MessageModel.DeleteMessageParams,
      body: MessageModel.DeleteMessageBody,
    },
  );

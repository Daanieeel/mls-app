import { Elysia } from 'elysia';
import { kafkaPlugin } from '../../utils/kafka';
import { requireAuth } from '../auth/guard';
import { MessageModel } from './model';
import { MessageService } from './service';
import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';

export const messageRouter = new Elysia({ prefix: '/messages' })
  .use(kafkaPlugin())
  .use(requireAuth)
  .post(
    '/',
    async ({ body, user, set, producer }) => {
      const createdCloudEvent: MinimalCloudEvent = await MessageService.createMessage({
        body,
        userId: user.id,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.MESSAGE,
        messages: [
          {
            key: body.groupId,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });

      set.status = 202;
      return createdCloudEvent;
    },
    { body: MessageModel.CreateMessageBody },
  )

  .use(requireAuth)
  .patch(
    '/:messageId',
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
            key: body.groupId,
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
    '/:messageId',
    ({ params, set }) => {
      const deletedMessage = MessageService.deleteMessage({
        params: params,
      });
      // TODO: Error() => undefined
      if (deletedMessage === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return deletedMessage;
    },
    {
      params: MessageModel.DeleteMessageParams,
    },
  );
    },
  );

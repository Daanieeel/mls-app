import { Elysia } from 'elysia';
import { kafkaPlugin } from '../../utils/kafka';
import { requireAuth } from '../auth/guard';
import { MessageModel } from './model';
import { MessageService } from './service';

export const messageRouter = new Elysia({ prefix: '/messages' })
  .use(kafkaPlugin())
  .use(requireAuth)
  .post(
    '/',
    ({ body, user, set }) => {
      set.status = 202;
      const createdMessage = MessageService.createMessage({ body, userId: user.id });
      return createdMessage;
    },
    { body: MessageModel.CreateMessageBody },
  )

  .use(requireAuth)
  .patch(
    '/:messageId',
    ({ body, params, user, set }) => {
      const updatedMessage = MessageService.updateMessage({ body, params, userId: user.id });
      // TODO: Error() => undefined
      if (updatedMessage === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return updatedMessage;
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

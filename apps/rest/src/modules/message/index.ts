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
    ({ body, user }) => {
      return MessageService.createMessage({ body, userId: user.id });
    },
    { body: MessageModel.CreateMessageBody },
  )

  .use(requireAuth)
  .patch(
    '/:messageId',
    ({ body, params, user }) => {
      return MessageService.updateMessage({ body, params, userId: user.id });
    },
    {
      body: MessageModel.UpdateMessageBody,
    },
  )

  .delete('/:id', ({ params }) => {
    return MessageService.deleteMessage({
      params: params,
    });
  });

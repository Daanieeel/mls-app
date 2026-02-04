import { Elysia } from 'elysia';
import { kafkaPlugin } from '../../utils/kafka';
import { MessageModel } from './model';
import { MessageService } from './service';

export const messageRouter = new Elysia({ prefix: '/messages' }).use(kafkaPlugin()).post(
  '/',
  ({ body }) => {
    MessageService.createMessage({ body: body });
  },
  { body: MessageModel.CreateMessageBody },
);

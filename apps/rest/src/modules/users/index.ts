import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';
import Elysia from 'elysia';
import { KeyService } from './service';
import { kafkaPlugin } from '../../utils/kafka';
import { KeyModel } from './model';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@repo/database/generated/prisma/runtime/library';
import { NoKeysFoundError } from '../../utils/custom_errors';

export const messageRouter = new Elysia({ prefix: '/users' }).use(kafkaPlugin()).get(
  '/:userId',
  async ({ params, set, producer }) => {
    try {
      // ? MinimalCloudEvent
      const createdCloudEvent = await KeyService.fetchKeys({
        params: params,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.KEY,
        messages: [
          {
            key: createdCloudEvent?.subject,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });

      set.status = 202;

      return createdCloudEvent;
    } catch (e) {
      if (
        e instanceof PrismaClientKnownRequestError ||
        PrismaClientUnknownRequestError ||
        PrismaClientRustPanicError
      ) {
        set.status = 500;
      }
      if (e instanceof PrismaClientInitializationError) {
        set.status = 503;
      }
      if (e instanceof NoKeysFoundError) {
        set.status = 404;
      }
    }
  },
  { params: KeyModel.FetchKeyParams },
);

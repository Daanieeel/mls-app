import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';
import Elysia from 'elysia';
import { KeyService } from './service';
import { kafkaPlugin } from '../../utils/kafka';
import { KeyModel } from './model';

export const messageRouter = new Elysia({ prefix: '/users' }).use(kafkaPlugin()).get(
  '/:id/invitation-key',
  async ({ params, set, producer }) => {
    // ? MinimalCloudEvent
    const createdCloudEvent = await KeyService.fetchKeys({
      params: params,
    });

    producer.send({
      topic: KAFKA_TOPIC_TYPES.KEY,
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
    params: KeyModel.FetchKeyParams,
  },
);

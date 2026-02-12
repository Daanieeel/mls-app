import { Elysia, t } from 'elysia';
import { requireAuth } from '../auth/guard';
import { kafkaPlugin } from '../../utils/kafka';
import { GroupModel } from './model';
import { GroupService } from './service';
import { KAFKA_TOPIC_TYPES, type MinimalCloudEvent } from '@repo/utils';

export const groupRouter = new Elysia({ prefix: '/groups' })
  .use(kafkaPlugin())
  .use(requireAuth)
  .post(
    '/',
    async ({ body, user, set, producer }) => {
      const { group, event } = await GroupService.createGroup({
        body: body,
        executorId: user.id,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.GROUP,
        messages: [
          {
            key: event.subject,
            value: JSON.stringify(event),
          },
        ],
      });

      set.status = 201;
      return group;
    },
    {
      body: GroupModel.CreateGroupBody,
    },
  )

  .post(
    '/:id/add-user',
    async ({ body, params, set, user, producer }) => {
      const result = await GroupService.addUserToGroup({
        body: body,
        params: params,
        executorId: user.id,
      });
      if (result === undefined) {
        set.status = 404;
        return { error: 'Not Found', message: 'Group not found' };
      }

      // Send the commit event through Kafka so the worker notifies all members
      producer.send({
        topic: KAFKA_TOPIC_TYPES.GROUP,
        messages: [
          {
            key: result.event.subject,
            value: JSON.stringify(result.event),
          },
        ],
      });

      set.status = 200;
      return result.group;
    },
    {
      body: GroupModel.AddUserBody,
      params: GroupModel.AddUserParams,
    },
  )

  .post(
    '/:id/remove-user',
    async ({ body, params, set, user, producer }) => {
      const result = await GroupService.removeUserFromGroup({
        body: body,
        params: params,
        executorId: user.id,
      });
      if (result === undefined) {
        set.status = 404;
        return { error: 'Not Found', message: 'Group not found' };
      }

      // Send the commit event through Kafka so the worker notifies all members
      producer.send({
        topic: KAFKA_TOPIC_TYPES.GROUP,
        messages: [
          {
            key: result.event.subject,
            value: JSON.stringify(result.event),
          },
        ],
      });

      set.status = 200;
      return result.group;
    },
    {
      body: GroupModel.RemoveUserBody,
      params: GroupModel.RemoveUserParams,
    },
  )

  .post(
    '/:id/leave',
    async ({ user, params, set, producer, body }) => {
      const createdCloudEvent: MinimalCloudEvent = await GroupService.leaveGroup({
        executorId: user.id,
        params: params,
        body: body,
      });

      producer.send({
        topic: KAFKA_TOPIC_TYPES.GROUP,
        messages: [
          {
            key: createdCloudEvent.subject,
            value: JSON.stringify(createdCloudEvent),
          },
        ],
      });

      set.status = 200;
      return { success: true };
    },
    {
      params: GroupModel.LeaveGroupParams,
      body: GroupModel.LeaveGroupBody,
    },
  )

  .get('/', ({ user }) => {
    return GroupService.getAllGroups({
      executorId: user.id,
    });
  })

  .get('/:id', async ({ user, params, set }) => {
    const group = await GroupService.getGroupById({
      executorId: user.id,
      groupId: params.id,
    });
    if (!group) {
      set.status = 404;
      return { error: 'Not Found', message: 'Group not found' };
    }
    return group;
  })

  .get('/sync', ({ user }) => {
    return GroupService.syncGroups({
      executorId: user.id,
    });
  });

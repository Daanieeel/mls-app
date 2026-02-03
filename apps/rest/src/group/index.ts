import { Elysia, t } from 'elysia';
import { GroupModel } from './model.js';
import { kafkaPlugin } from '../kafka.js';

export const groupRouter = new Elysia({ prefix: '/group' })
  .get('/', () => 'Group Home')
  .post(
    '/create',
    ({ body, set }) => {
      set.status = 202;
    },
    {
      body: GroupModel.CreateGroupBody,
    },
  );

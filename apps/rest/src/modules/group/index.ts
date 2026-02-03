import { Elysia, t } from 'elysia';
import { GroupModel } from './model';
import { GroupService } from './service';

export const groupRouter = new Elysia({ prefix: '/groups' })
  .get('/', () => {
    GroupService.getAllGroups();
  })
  .get('/:id', ({ params }) => {
    GroupService.getGroup({
      params: params,
    });
  })
  .post(
    '/',
    ({ body }) => {
      return GroupService.createGroup({
        body: body,
        id: '1',
      });
    },
    {
      body: GroupModel.CreateGroupBody,
    },
  )
  .patch(
    '/:id',
    ({ body, params }) => {
      return GroupService.updateGroup({
        body: body,
        params: params,
      });
    },
    {
      body: GroupModel.UpdateGroupBody,
      params: GroupModel.UpdateGroupParams,
    },
  )
  .delete('/:id', ({ params }) => {
    return GroupService.deleteGroup({
      params: params,
    });
  });

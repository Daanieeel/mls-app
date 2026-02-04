import { Elysia, t } from 'elysia';
import { requireAuth } from '../auth/guard';
import { GroupModel } from './model';
import { GroupService } from './service';

export const groupRouter = new Elysia({ prefix: '/groups' })
  .use(requireAuth)
  .post(
    '/',
    ({ body, user, set }) => {
      const createdGroup = GroupService.createGroup({
        body: body,
        executorId: user.id,
      });
      set.status = 202;
      return createdGroup;
    },
    {
      body: GroupModel.CreateGroupBody,
    },
  )
  .post(
    '/:id/add-user',
    ({ body, params, set }) => {
      const updatedGroup = GroupService.addUserToGroup({
        body: body,
        params: params,
      });
      if (updatedGroup === undefined) {
        //TODO: catch prisma error P2025
        set.status = 404;
      } else {
        set.status = 202;
      }
      return updatedGroup;
    },
    {
      body: GroupModel.AddUserBody,
      params: GroupModel.AddUserParams,
    },
  )
  .post(
    '/:id/remove-user',
    ({ body, params, set }) => {
      const updatedGroup = GroupService.removeUserFromGroup({
        body: body,
        params: params,
      });
      if (updatedGroup === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return updatedGroup;
    },
    {
      body: GroupModel.RemoveUserBody,
      params: GroupModel.RemoveUserParams,
    },
  )
  .post(
    '/:id/leave',
    ({ user, params, set }) => {
      const updatedGroup = GroupService.leaveGroup({
        executorId: user.id,
        params: params,
      });
      if (updatedGroup === undefined) {
        set.status = 404;
      } else {
        set.status = 202;
      }
      return updatedGroup;
    },
    {
      params: GroupModel.LeaveGroupParams,
    },
  )
  .get('/', ({ user, set }) => {
    const groups = GroupService.getAllGroups({
      executorId: user.id,
    });
    set.status = 200;
    return groups;
  })
  .get('/:id', ({ user, params, set }) => {
    const group = GroupService.getGroupById({
      executorId: user.id,
      groupId: params.id,
    });
    if (group === undefined) {
      set.status = 404;
    } else {
      set.status = 200;
    }
    return group;
  })
  .get('/sync', ({ user, set }) => {
    const groups = GroupService.syncGroups({
      executorId: user.id,
    });
    set.status = 200;
    return groups;
  });

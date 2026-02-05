import { prisma } from '@repo/database';
import type { GroupModel } from './model';
import { CloudEvent } from 'cloudevents';
import { CLOUD_EVENT_TYPES, type MinimalCloudEvent } from '@repo/utils';

export abstract class GroupService {
  static async createGroup({
    body,
    executorId,
  }: { body: (typeof GroupModel.CreateGroupBody)['static']; executorId: string }) {
    const createdGroup = await prisma.group.create({
      data: {
        ...body.options,
        createdBy: {
          connect: {
            id: executorId,
          },
        },
        members: {
          connect: body.options.memberIds.map((item) => ({
            userId: item,
          })),
        },
      },
    });

    const groupEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.GROUP_CREATED,
      source: '/groups/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: createdGroup.id,
      data: {
        payload: body.welcomeMessage.payload,
        type: body.welcomeMessage.type,
        nonce: body.welcomeMessage.nonce,
      },
    });

    return groupEvent;
  }

  static addUserToGroup({
    body,
    params,
  }: {
    body: (typeof GroupModel.AddUserBody)['static'];
    params: (typeof GroupModel.AddUserParams)['static'];
  }) {
    return prisma.group.update({
      where: {
        id: params.groupId,
      },
      data: {
        ...body,
        members: {
          connect: {
            userId_groupId: {
              groupId: params.groupId,
              userId: body.targetId,
            },
          },
        },
      },
    });
  }

  static removeUserFromGroup({
    body,
    params,
  }: {
    body: (typeof GroupModel.RemoveUserBody)['static'];
    params: (typeof GroupModel.RemoveUserParams)['static'];
  }) {
    return prisma.group.update({
      where: {
        id: params.groupId,
      },
      data: {
        ...body,
        members: {
          disconnect: {
            userId_groupId: {
              groupId: params.groupId,
              userId: body.targetId,
            },
          },
        },
      },
    });
  }

  static leaveGroup({
    executorId,
    params,
  }: { executorId: string; params: (typeof GroupModel.LeaveGroupParams)['static'] }) {
    return prisma.group.update({
      where: {
        id: params.groupId,
      },
      data: {
        members: {
          disconnect: {
            userId_groupId: {
              userId: executorId,
              groupId: params.groupId,
            },
          },
        },
      },
    });
  }

  static getAllGroups({ executorId }: { executorId: string }) {
    return prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: executorId,
          },
        },
      },
    });
  }

  static getGroupById({ executorId, groupId }: { executorId: string; groupId: string }) {
    return prisma.group.findFirst({
      where: {
        members: {
          some: {
            userId: executorId,
            groupId: groupId,
          },
        },
      },
    });
  }

  static syncGroups({ executorId }: { executorId: string }) {
    return prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: executorId,
          },
        },
      },
    });
  }
}

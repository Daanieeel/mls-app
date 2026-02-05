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
          create: body.options.memberIds.map((item) => ({
            user: {
              connect: {
                id: item,
              },
            },
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

  static async addUserToGroup({
    body,
    params,
  }: {
    body: (typeof GroupModel.AddUserBody)['static'];
    params: (typeof GroupModel.AddUserParams)['static'];
  }) {
    const updatedGroup = await prisma.group.update({
      where: {
        id: params.groupId,
      },
      data: {
        members: {
          create: {
            user: {
              connect: {
                id: body.options.userId,
              },
            },
          },
        },
      },
    });

    const groupEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.GROUP_USER_ADDED,
      source: '/groups/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: updatedGroup.id,
      data: {
        payload: body.welcomeMessage.payload,
        type: body.welcomeMessage.type,
        nonce: body.welcomeMessage.nonce,
      },
    });

    return groupEvent;
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
        members: {
          delete: {
            userId_groupId: {
              userId: body.targetId,
              groupId: params.groupId,
            },
          },
        },
      },
    });
  }

  static async leaveGroup({
    executorId,
    params,
    body,
  }: {
    executorId: string;
    params: (typeof GroupModel.LeaveGroupParams)['static'];
    body: (typeof GroupModel.LeaveGroupBody)['static'];
  }) {
    const updatedGroup = await prisma.group.update({
      where: {
        id: params.groupId,
      },
      data: {
        members: {
          delete: {
            userId_groupId: {
              userId: executorId,
              groupId: params.groupId,
            },
          },
        },
      },
    });
    const groupEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.GROUP_LEFT,
      source: '/groups/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: updatedGroup.id,
      data: {
        nonce: body.nonce,
        type: body.type,
        payload: body.payload.toString(),
      },
    });
    return groupEvent;
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

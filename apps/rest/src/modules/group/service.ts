import { prisma } from '@repo/database';
import type { GroupModel } from './model';

export abstract class GroupService {
  static createGroup({
    body,
    executorId,
  }: { body: (typeof GroupModel.CreateGroupBody)['static']; executorId: string }) {
    return prisma.group.create({
      data: {
        ...body,
        createdBy: {
          connect: {
            id: executorId,
          },
        },
      },
    });
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

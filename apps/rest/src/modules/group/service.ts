import { prisma } from '@repo/database';
import type { GroupModel } from './model';

export abstract class GroupService {
  static createGroup({
    body,
    id,
  }: { body: typeof GroupModel.CreateGroupBody['static']; id: string }) {
    return prisma.group.create({
      data: {
        ...body,
        createdBy: {
          connect: {
            id: id,
          },
        },
      },
    });
  }

  static updateGroup({
    body,
    params,
  }: {
    body: typeof GroupModel.UpdateGroupBody['static'];
    params: typeof GroupModel.UpdateGroupParams['static'];
  }) {
    return prisma.group.update({
      where: {
        ...params,
      },
      data: {
        ...body,
      },
    });
  }

  static deleteGroup({
    params,
  }: {
    params: typeof GroupModel.DeleteGroupParams['static'];
  }) {
    return prisma.group.delete({
      where: {
        ...params,
      },
    });
  }

  static getAllGroups() {
    return prisma.group.findMany();
  }

  static getGroup({
    params,
  }: {
    params: typeof GroupModel.GetGroupParams['static'];
  }) {
    return prisma.group.findUnique({
      where: {
        id: params.id,
      },
    });
  }
}

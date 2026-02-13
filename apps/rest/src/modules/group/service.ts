import { prisma } from '@repo/database';
import type { GroupModel } from './model';
import { CloudEvent } from 'cloudevents';
import { CLOUD_EVENT_TYPES, type MinimalCloudEvent } from '@repo/utils';

export abstract class GroupService {
  static async createGroup({
    body,
    executorId,
  }: { body: (typeof GroupModel.CreateGroupBody)['static']; executorId: string }) {
    // Include the creator as a member as well
    const allMemberIds = [...new Set([executorId, ...body.options.memberIds])];

    const createdGroup = await prisma.group.create({
      data: {
        name: body.options.name,
        createdBy: {
          connect: {
            id: executorId,
          },
        },
        members: {
          create: allMemberIds.map((id) => ({
            user: {
              connect: { id },
            },
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    const creator = createdGroup.members.find((m) => m.userId === executorId)?.user;

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
        senderId: executorId,
        actorName: creator?.name ?? creator?.email ?? executorId,
      },
    });

    return { group: createdGroup, event: groupEvent };
  }

  static async addUserToGroup({
    body,
    params,
    executorId,
  }: {
    body: (typeof GroupModel.AddUserBody)['static'];
    params: (typeof GroupModel.AddUserParams)['static'];
    executorId: string;
  }) {
    const updatedGroup = await prisma.group.update({
      where: {
        id: params.id,
      },
      data: {
        members: {
          create: {
            userId: body.targetId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    const executor = updatedGroup.members.find((m) => m.userId === executorId)?.user;
    const target = updatedGroup.members.find((m) => m.userId === body.targetId)?.user;

    const groupEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.GROUP_USER_ADDED,
      source: '/groups/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: params.id,
      data: {
        payload: body.commitMessage.payload,
        type: body.commitMessage.type,
        nonce: body.commitMessage.nonce,
        senderId: executorId,
        actorName: executor?.name ?? executor?.email ?? executorId,
        targetName: target?.name ?? target?.email ?? body.targetId,
        targetId: body.targetId,
      },
    });

    return { group: updatedGroup, event: groupEvent };
  }

  static async removeUserFromGroup({
    body,
    params,
    executorId,
  }: {
    body: (typeof GroupModel.RemoveUserBody)['static'];
    params: (typeof GroupModel.RemoveUserParams)['static'];
    executorId: string;
  }) {
    // Fetch target user name before removal
    const targetUser = await prisma.user.findUnique({
      where: { id: body.targetId },
      select: { id: true, email: true, name: true },
    });

    const updatedGroup = await prisma.group.update({
      where: {
        id: params.id,
      },
      data: {
        members: {
          delete: {
            userId_groupId: {
              userId: body.targetId,
              groupId: params.id,
            },
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    const executor = updatedGroup.members.find((m) => m.userId === executorId)?.user;

    const groupEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.GROUP_USER_REMOVED,
      source: '/groups/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: params.id,
      data: {
        payload: body.commitMessage.payload,
        type: body.commitMessage.type,
        nonce: body.commitMessage.nonce,
        senderId: executorId,
        actorName: executor?.name ?? executor?.email ?? executorId,
        targetName: targetUser?.name ?? targetUser?.email ?? body.targetId,
        targetId: body.targetId,
      },
    });

    return { group: updatedGroup, event: groupEvent };
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
    // Fetch executor name and current member count before removal
    const [executorUser, group] = await Promise.all([
      prisma.user.findUnique({
        where: { id: executorId },
        select: { id: true, email: true, name: true },
      }),
      prisma.group.findUnique({
        where: { id: params.id },
        select: { _count: { select: { members: true } } },
      }),
    ]);

    const isLastMember = group?._count.members === 1;

    if (isLastMember) {
      // Delete the entire group if this is the last member
      // Use transaction to remove member, related messages, inbox items, then delete the group
      await prisma.$transaction([
        // Delete inbox items that reference messages in this group
        prisma.userInboxItem.deleteMany({
          where: { groupId: params.id },
        }),
        // Delete global messages in this group
        prisma.globalMessage.deleteMany({
          where: { groupId: params.id },
        }),
        // Remove the last member
        prisma.groupMember.delete({
          where: {
            userId_groupId: {
              userId: executorId,
              groupId: params.id,
            },
          },
        }),
        // Delete the group itself
        prisma.group.delete({
          where: { id: params.id },
        }),
      ]);

      const groupEvent: MinimalCloudEvent = new CloudEvent({
        specversion: '1.0',
        type: CLOUD_EVENT_TYPES.GROUP_LEFT,
        source: '/groups/',
        time: new Date().toISOString(),
        datacontenttype: 'application/json',
        subject: params.id,
        data: {
          nonce: body.nonce,
          type: body.type,
          payload: body.payload,
          senderId: executorId,
          actorName: executorUser?.name ?? executorUser?.email ?? executorId,
          groupDeleted: true,
        },
      });
      return groupEvent;
    }

    // Otherwise, just remove the user from the group
    const updatedGroup = await prisma.group.update({
      where: {
        id: params.id,
      },
      data: {
        members: {
          delete: {
            userId_groupId: {
              userId: executorId,
              groupId: params.id,
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
        payload: body.payload,
        senderId: executorId,
        actorName: executorUser?.name ?? executorUser?.email ?? executorId,
        groupDeleted: false,
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
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static getGroupById({ executorId, groupId }: { executorId: string; groupId: string }) {
    return prisma.group.findFirst({
      where: {
        id: groupId,
        members: {
          some: {
            userId: executorId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
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
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });
  }
}

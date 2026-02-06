import { prisma } from '@repo/database';
import type { MessageModel } from './model';
import { CloudEvent } from 'cloudevents';
import { CLOUD_EVENT_TYPES, type MinimalCloudEvent } from '@repo/utils';

export abstract class MessageService {
  static async createMessage({
    body,
    userId,
  }: {
    body: (typeof MessageModel.CreateMessageBody)['static'];
    userId: string;
  }) {
    const createdMessage = await prisma.globalMessage.create({
      data: {
        ...body,
        sender: {
          connect: {
            id: userId,
          },
        },
        group: {
          connect: {
            id: body.groupId,
          },
        },
        groupId: undefined,
        payload: Buffer.from(body.payload),
      },
    });
    const messageEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.MESSAGE_SENT,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: body.groupId,
      data: {
        ...createdMessage,
        payload: createdMessage.payload.toString(),
      },
    });
    return messageEvent;
  }

  static async updateMessage({
    body,
    params,
    userId,
  }: {
    body: (typeof MessageModel.UpdateMessageBody)['static'];
    params: (typeof MessageModel.UpdateMessageParams)['static'];
    userId: string;
  }) {
    const updatedMessage = await prisma.globalMessage.update({
      where: {
        id: params.id,
        senderId: userId,
      },
      data: {
        ...body,
        payload: Buffer.from(body.payload),
      },
    });
    const messageEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.MESSAGE_UPDATED,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: updatedMessage.groupId,
      data: {
        ...updatedMessage,
        payload: updatedMessage.payload.toString(),
      },
    });
    return messageEvent;
  }

  static async deleteMessage({
    params,
    body,
  }: {
    body: (typeof MessageModel.DeleteMessageBody)['static'];
    params: (typeof MessageModel.DeleteMessageParams)['static'];
  }) {
    const deletedMessage = await prisma.globalMessage.delete({
      where: {
        id: params.id,
        senderId: body.executorId,
      },
    });
    const messageEvent: MinimalCloudEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.MESSAGE_DELETED,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: deletedMessage.groupId,
      data: {
        ...deletedMessage,
        payload: deletedMessage.payload.toString(),
      },
    });
    return messageEvent;
  }

  static async getAllMessages({
    body,
  }: {
    body: (typeof MessageModel.GetAllMessagesBody)['static'];
  }) {
    const messages = await prisma.globalMessage.findMany({
      where: {
        groupId: body.groupId,
        group: {
          members: {
            some: {
              userId: body.executorId,
            },
          },
        },
      },
    });

    return messages;
  }

  static async getMessageById({
    body,
    params,
  }: {
    body: (typeof MessageModel.GetMessageByIdBody)['static'];
    params: (typeof MessageModel.GetMessageByIdParams)['static'];
  }) {
    const message = await prisma.globalMessage.findFirst({
      where: {
        id: params.messageId,
        group: {
          members: {
            some: {
              userId: body.executorId,
            },
          },
        },
      },
    });
  }
}

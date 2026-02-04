import { prisma } from '@repo/database';
import type { MessageModel } from './model';
import { CloudEvent } from 'cloudevents';
import { CLOUD_EVENT_TYPES } from '@repo/utils';

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
        payload: Buffer.from(body.payload),
      },
    });
    const messageEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.MESSAGE_SENT,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: body.groupId,
      data: createdMessage,
    });
    return messageEvent;
  }

  static updateMessage({
    body,
    params,
    userId,
  }: {
    body: (typeof MessageModel.UpdateMessageBody)['static'];
    params: (typeof MessageModel.UpdateMessageParams)['static'];
    userId: string;
  }) {
    const updatedMessage = prisma.globalMessage.update({
      where: {
        id: params.messageId,
      },
      data: {
        ...body,
        sender: {
          connect: {
            id: userId,
          },
        },
        payload: Buffer.from(body.payload),
      },
    });
    const messageEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.MESSAGE_UPDATED,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: body.groupId,
      data: updatedMessage,
    });
    return messageEvent;
  }

  static deleteMessage({
    params,
  }: { params: (typeof MessageModel.DeleteMessageParams)['static'] }) {
    return prisma.globalMessage.delete({
      where: {
        ...params,
      },
    });
  }
}

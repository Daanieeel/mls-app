import { prisma } from '@repo/database';
import type { MessageModel } from './model';
import { CloudEvent } from 'cloudevents';
import { EVENT_TYPES } from '../../utils/events';

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
      type: EVENT_TYPES.MESSAGE_SENT,
      source: '/messages/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: createdMessage.id,
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
    return prisma.globalMessage.update({
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

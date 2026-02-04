import { prisma } from '@repo/database';
import type { MessageModel } from './model';

export abstract class MessageService {
  static createMessage({
    body,
    userId,
  }: {
    body: typeof MessageModel.CreateMessageBody['static'];
    userId: string;
  }) {
    return prisma.globalMessage.create({
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

  static updateMessage({
    body,
    params,
    userId,
  }: {
    body: typeof MessageModel.UpdateMessageBody['static'];
    params: typeof MessageModel.UpdateMessageParams['static'];
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

  static deleteMessage({ params }: { params: typeof MessageModel.DeleteMessageParams['static'] }) {
    return prisma.globalMessage.delete({
      where: {
        ...params,
      },
    });
  }
}

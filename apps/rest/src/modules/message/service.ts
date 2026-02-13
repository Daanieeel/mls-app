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
    const { groupId, payload, ...rest } = body;

    console.log('[REST:MessageService] createMessage called', {
      groupId,
      payloadLength: payload.length,
      payloadPreview: payload.substring(0, 80),
      type: rest.type,
    });

    // The payload arrives as a base64 string from the client.
    // Store the raw bytes in Prisma's Bytes field.
    const payloadBuffer = Buffer.from(payload, 'utf-8');
    console.log('[REST:MessageService] Storing payload buffer', {
      bufferLength: payloadBuffer.length,
      bufferPreview: payloadBuffer.toString('utf-8').substring(0, 80),
    });

    const createdMessage = await prisma.globalMessage.create({
      data: {
        ...rest,
        sender: {
          connect: {
            id: userId,
          },
        },
        group: {
          connect: {
            id: groupId,
          },
        },
        payload: payloadBuffer,
      },
    });

    // Reconstruct the original payload string from Prisma's Bytes.
    // Buffer.from() ensures we have a real Node/Bun Buffer (not a plain Uint8Array)
    // so that .toString('utf-8') returns the original string, not comma-separated bytes.
    const payloadString = Buffer.from(createdMessage.payload).toString('utf-8');
    console.log('[REST:MessageService] CloudEvent payload reconstructed', {
      payloadString: payloadString.substring(0, 80),
      matchesInput: payloadString === payload,
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
        payload: payloadString,
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
    console.log('[REST:MessageService] updateMessage called', {
      messageId: params.id,
      payloadLength: body.payload.length,
      payloadPreview: body.payload.substring(0, 80),
    });

    // Verify ownership: only the original sender can edit a message
    const existing = await prisma.globalMessage.findUnique({
      where: { id: params.id },
      select: { senderId: true },
    });
    if (!existing) {
      throw new Error('Message not found');
    }
    if (existing.senderId !== userId) {
      throw new Error('You can only edit your own messages');
    }

    const updatedMessage = await prisma.globalMessage.update({
      where: {
        id: params.id,
      },
      data: {
        payload: Buffer.from(body.payload, 'utf-8'),
        nonce: body.nonce,
        type: body.type,
      },
    });

    const payloadString = Buffer.from(updatedMessage.payload).toString('utf-8');
    console.log('[REST:MessageService] updateMessage payload reconstructed', {
      payloadString: payloadString.substring(0, 80),
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
        payload: payloadString,
      },
    });
    return messageEvent;
  }

  static async deleteMessage({
    params,
    userId,
  }: {
    params: (typeof MessageModel.DeleteMessageParams)['static'];
    userId: string;
  }) {
    // Verify ownership: only the original sender can delete a message
    const existing = await prisma.globalMessage.findUnique({
      where: { id: params.id },
      select: { senderId: true },
    });
    if (!existing) {
      throw new Error('Message not found');
    }
    if (existing.senderId !== userId) {
      throw new Error('You can only delete your own messages');
    }

    const deletedMessage = await prisma.globalMessage.delete({
      where: {
        id: params.id,
      },
    });
    const payloadString = Buffer.from(deletedMessage.payload).toString('utf-8');
    console.log('[REST:MessageService] deleteMessage payload reconstructed', {
      messageId: params.id,
      payloadPreview: payloadString.substring(0, 80),
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
        payload: payloadString,
      },
    });
    return messageEvent;
  }
}

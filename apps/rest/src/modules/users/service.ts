import { prisma } from '@repo/database';
import type { KeyModel } from './model';
import { CLOUD_EVENT_TYPES, type MinimalCloudEvent } from '@repo/utils';
import { CloudEvent } from 'cloudevents';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@repo/database/generated/prisma/runtime/library';
import { NoKeysFoundError } from '../../utils/custom_errors';

export abstract class KeyService {
  static async fetchKeys({ params }: { params: (typeof KeyModel.FetchKeyParams)['static'] }) {
    try {
      const fetchedKeys = await prisma.keyPackage.findFirst({
        orderBy: {
          createdAt: 'asc',
        },
        where: {
          userId: params.userId,
          usedAt: null,
        },
      });

      if (!fetchedKeys) {
        throw new NoKeysFoundError('No unused keys found.');
      }

      const messageEvent = new CloudEvent({
        specversion: '1.0',
        type: CLOUD_EVENT_TYPES.KEYS_FETCHED,
        source: '/keys/',
        time: new Date().toISOString(),
        datacontenttype: 'application/json',
        subject: fetchedKeys.id,
        data: {
          ...fetchedKeys,
          payload: fetchedKeys.payload.toString(),
        },
      });

      return messageEvent;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        throw new Error(e.code);
      }
      if (e instanceof PrismaClientUnknownRequestError || PrismaClientRustPanicError) {
        throw new Error('Internal Server Error.');
      }
      if (e instanceof PrismaClientInitializationError) {
        throw new Error('Database unavailable.');
      }
      throw e;
    }
  }
}

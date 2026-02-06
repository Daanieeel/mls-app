import { prisma } from '@repo/database';
import type { KeyModel } from './model';
import { CLOUD_EVENT_TYPES, type MinimalCloudEvent } from '@repo/utils';
import { CloudEvent } from 'cloudevents';

export abstract class KeyService {
  static async fetchKeys({
    params,
  }: {
    params: (typeof KeyModel.FetchKeyParams)['static'];
  }) {
    const fetchedKeys = await prisma.keyPackage.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        userId: params.userId,
        usedAt: undefined,
      },
    });

    const messageEvent = new CloudEvent({
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.KEYS_FETCHED,
      source: '/keys/',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: fetchedKeys?.id,
      data: {
        ...fetchedKeys,
        payload: fetchedKeys?.payload.toString(),
      },
    });

    return messageEvent;
  }
}

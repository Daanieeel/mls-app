import type { CloudEvent } from 'cloudevents';

export const CLOUD_EVENT_TYPES = {
  MESSAGE_SENT: 'de.messenger.message.sent',
  MESSAGE_UPDATED: 'de.messenger.message.updated',
  MESSAGE_DELETED: 'de.messenger.message.deleted',
  MESSAGE_NOTIFICATION_PUBLISHED: 'de.messenger.message.notification.published',
  GROUP_LEFT: 'de.messenger.group.left',
  GROUP_CREATED: 'de.messenger.group.created',
  GROUP_USER_REMOVED: 'de.messenger.message.user-removed',
} as const;

export const KAFKA_TOPIC_TYPES = {
  MESSAGE: 'message-events',
  GROUP: 'group-events',
} as const;

export type CloudEventType = (typeof CLOUD_EVENT_TYPES)[keyof typeof CLOUD_EVENT_TYPES];

export type MinimalCloudEventData = {
  type: string;
  payload: string;
  nonce: string;
};

export type MinimalCloudEvent = CloudEvent<MinimalCloudEventData>;

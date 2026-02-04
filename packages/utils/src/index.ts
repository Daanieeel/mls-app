export const CLOUD_EVENT_TYPES = {
  MESSAGE_SENT: 'de.messenger.message.sent',
  MESSAGE_UPDATED: 'de.messenger.message.updated',
  MESSAGE_NOTIFICATION_PUBLISHED: 'de.messenger.message.notification.published',
} as const;

export const KAFKA_TOPIC_TYPES = {
  MESSAGE: 'message-events',
  GROUP: 'group-events',
} as const;

export type CloudEventType = (typeof CLOUD_EVENT_TYPES)[keyof typeof CLOUD_EVENT_TYPES];

export const CLOUD_EVENT_TYPES = {
  MESSAGE_SENT: 'de.messenger.message.sent',
  MESSAGE_UPDATED: 'de.messenger.message.updated',
} as const;

export const KAFKA_TOPIC_TYPES = {
  MESSAGE: 'message-events',
  GROUP: 'group-events',
} as const;

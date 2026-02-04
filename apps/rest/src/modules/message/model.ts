import { t } from 'elysia';

export namespace MessageModel {
  export const CreateMessageBody = t.Object({
    nonce: t.String(),
    payload: t.String(),
    type: t.String(),
    groupId: t.String(),
  });
  export const UpdateMessageBody = t.Object({
    nonce: t.String(),
    payload: t.String(),
    type: t.String(),
  });
  export const DeleteMessageParams = t.Object({
    id: t.String(),
  });
  export const UpdateMessageParams = t.Object({
    messageId: t.String(),
  });
}

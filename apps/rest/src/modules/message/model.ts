import { t } from 'elysia';

export namespace MessageModel {
  export const CreateMessageBody = t.Object({
    nonce: t.String(),
    payload: t.String(),
    type: t.String(),
  });
}

import { Elysia, t } from 'elysia';

const PAYLOAD_REGEX = '^[A-Za-z0-9\\-_+/]+={0,2}$|^[0-9a-fA-F]+$';

const PayloadOptions = {
  minLength: 8,
  maxLength: 1024 * 512,
  pattern: PAYLOAD_REGEX,
  error: 'Invalid Payload: Must be 8-512KB and correctly encoded',
};

const CryptoPayload = t.String(PayloadOptions);
const WelcomePayload = t.String({
  ...PayloadOptions,
  minLength: 32,
  error: 'Invalid Welcome Payload: Must be at least 32 chars',
});

const GroupId = t.String({
  format: 'uuid',
  error: 'Invalid Group ID',
});

export namespace WebSocketModel {
  export const MessageBody = t.Union([
    // 1. WELCOME
    t.Object({
      type: t.Literal('WELCOME'),
      payload: WelcomePayload,
      group_id: GroupId,
    }),

    // 2. COMMIT
    t.Object({
      type: t.Literal('COMMIT'),
      payload: CryptoPayload,
      group_id: GroupId,
    }),

    // 3. MSG
    t.Object({
      type: t.Literal('MSG'),
      payload: CryptoPayload,
      group_id: GroupId,
    }),

    // 4. TOMBSTONE
    t.Object({
      type: t.Literal('TOMBSTONE'),
      payload: CryptoPayload,
      group_id: GroupId,
    }),

    // 5. EDIT
    t.Object({
      type: t.Literal('EDIT'),
      payload: CryptoPayload,
      group_id: GroupId,
    }),
  ]);
}

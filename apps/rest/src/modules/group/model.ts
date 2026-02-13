import { t } from 'elysia';

export namespace GroupModel {
  export const CreateGroupBody = t.Object({
    welcomeMessage: t.Object({
      payload: t.String(),
      nonce: t.String(),
      type: t.Literal('WELCOME'),
    }),
    options: t.Object({
      name: t.String(),
      memberIds: t.Array(t.String()),
    }),
  });

  export const GroupIdParams = t.Object({
    id: t.String(),
  });

  export const AddUserBody = t.Object({
    targetId: t.String(),
    commitMessage: t.Object({
      payload: t.String(),
      nonce: t.String(),
      type: t.Literal('COMMIT'),
    }),
  });
  export const AddUserParams = t.Object({
    id: t.String(),
  });
  export const RemoveUserBody = t.Object({
    targetId: t.String(),
    commitMessage: t.Object({
      payload: t.String(),
      nonce: t.String(),
      type: t.Literal('COMMIT'),
    }),
  });
  export const RemoveUserParams = t.Object({
    id: t.String(),
  });
  export const LeaveGroupParams = t.Object({
    id: t.String(),
  });
  export const LeaveGroupBody = t.Object({
    payload: t.String(),
    nonce: t.String(),
    type: t.Literal('COMMIT'),
  });
}

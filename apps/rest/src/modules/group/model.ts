import { t } from 'elysia';

export namespace GroupModel {
  export const CreateGroupBody = t.Object({
    name: t.String(),
  });
  export const AddUserBody = t.Object({
    targetId: t.String(),
  });
  export const AddUserParams = t.Object({
    groupId: t.String(),
  });
  export const RemoveUserBody = t.Object({
    targetId: t.String(),
  });
  export const RemoveUserParams = t.Object({
    groupId: t.String(),
  });
  export const LeaveGroupParams = t.Object({
    groupId: t.String(),
  });
}

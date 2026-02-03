import { t } from 'elysia';

export namespace GroupModel {
  export const CreateGroupBody = t.Object({
    name: t.String(),
  });
  export const UpdateGroupBody = t.Object({
    name: t.Optional(t.String()),
  });
  export const UpdateGroupParams = t.Object({
    id: t.String(),
  });
  export const DeleteGroupParams = t.Object({
    id: t.String(),
  });
  export const GetGroupParams = t.Object({
    id: t.String(),
  });
}

import { t } from 'elysia';

export namespace GroupModel {
  export const CreateGroupBody = t.Object({
    name: t.String(),
  });
}

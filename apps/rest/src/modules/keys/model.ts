import { t } from 'elysia';
export namespace KeyModel {
  export const FetchKeyParams = t.Object({
    userId: t.String(),
  });
}

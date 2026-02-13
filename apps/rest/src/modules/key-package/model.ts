import { t } from 'elysia';

export namespace KeyPackageModel {
  export const UploadBody = t.Object({
    keyPackages: t.Array(
      t.Object({
        payload: t.String({ description: 'Base64-encoded key package' }),
      }),
      { minItems: 1, maxItems: 100 },
    ),
  });

  export const ClaimParams = t.Object({
    userId: t.String(),
  });

  export const CountResponse = t.Object({
    count: t.Number(),
  });
}

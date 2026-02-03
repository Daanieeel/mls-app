# @repo/env

Shared environment schemas and helpers for the monorepo. Provides small wrappers
around `@t3-oss/env-core` and `@t3-oss/env-nextjs` so apps can share a single
source of truth for environment validation.

Usage examples

- Node services (rest, worker, websocket):

```ts
import { makeCoreEnv, processEnv, extendServerSchema } from '@repo/env';

const env = makeCoreEnv(processEnv(process.env), extendServerSchema({
  // per-app server vars
  KAFKA_CLIENT_ID: z.string(),
}));

export default env;
```

- Next.js (website):

```ts
import { makeNextEnv, processEnv } from '@repo/env';
import { z } from 'zod';

const serverSchema = {
  NODE_ENV: z.enum(['development','test','production']).default('development'),
};

const clientSchema = {
  NEXT_PUBLIC_API_URL: z.string().optional(),
};

export const env = makeNextEnv(processEnv(process.env), serverSchema, clientSchema);
```

Notes

- Client-side environment keys must start with `NEXT_PUBLIC_` in Next.js.
- Pass `SKIP_ENV_VALIDATION=1` to skip validation at build time (useful for Docker).

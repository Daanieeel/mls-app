import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEnv as createCoreEnv } from '@t3-oss/env-core';
import { createEnv as createNextEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Centralized environment variable validation and export.
 * All apps use this single source of truth for environment variables.
 */

// Load .env file from monorepo root if not already loaded
function loadEnvFromRoot() {
  // Try to find and load the root .env file
  const possibleRootPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../../.env'),
  ];

  for (const envPath of possibleRootPaths) {
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Only set if not already set
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      break;
    }
  }
}

// Load env vars before validation
loadEnvFromRoot();

// Base server schema shared across all services
const serverSchema = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Authentication
  BETTER_AUTH_SECRET: process.env.NODE_ENV === 'production' ? z.string() : z.string().optional(),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),

  // Kafka
  KAFKA_BROKERS: z.string(),
  KAFKA_CLIENT_ID_REST: z.string(),
  KAFKA_GROUP_ID_REST: z.string().optional(),
  KAFKA_CLIENT_ID_WEBSOCKET: z.string(),
  KAFKA_GROUP_ID_WEBSOCKET: z.string().optional(),
  KAFKA_CLIENT_ID_WORKER: z.string(),
  KAFKA_GROUP_ID_WORKER: z.string(),

  // Application Ports
  PORT_REST: z.coerce.number(),
  PORT_WEBSOCKET: z.coerce.number(),
  PORT_WEBSITE: z.coerce.number(),
  PORT_WORKER: z.coerce.number(),
};

// Client schema for Next.js
const clientSchema = {
  NEXT_PUBLIC_API_URL: z.string().optional(),
};

/**
 * Centralized environment object for all services.
 * Import this in your apps instead of creating local env validations.
 */
export const env = createCoreEnv({
  server: serverSchema,
  runtimeEnv: process.env as Record<string, string | undefined>,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/**
 * Environment object for Next.js apps with client-side variables.
 */
export const nextEnv = createNextEnv({
  server: serverSchema,
  client: clientSchema,
  runtimeEnv: process.env as Record<string, string | undefined>,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/**
 * Legacy helpers - kept for backward compatibility but not needed anymore.
 * @deprecated Use the centralized `env` or `nextEnv` exports instead.
 */
export const serverSchemaBase: Record<string, z.ZodTypeAny> = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().optional(),
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().optional(),
  KAFKA_GROUP_ID: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
};

/**
 * @deprecated Use the centralized `env` export instead.
 */
export const extendServerSchema = <T extends Record<string, z.ZodTypeAny>>(
  extra: T,
): Record<string, z.ZodTypeAny> => ({
  ...serverSchemaBase,
  ...extra,
});

/**
 * @deprecated Use the centralized `env` export instead.
 */
export function makeCoreEnv(
  runtimeEnv: NodeJS.ProcessEnv,
  serverSchema: Record<string, z.ZodTypeAny> = serverSchemaBase,
  options?: { skipValidation?: boolean; emptyStringAsUndefined?: boolean },
): ReturnType<typeof createCoreEnv> {
  return createCoreEnv({
    server: serverSchema,
    runtimeEnv: runtimeEnv as unknown as Record<string, string | number | boolean | undefined>,
    skipValidation:
      typeof options?.skipValidation === 'boolean'
        ? options?.skipValidation
        : !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined:
      typeof options?.emptyStringAsUndefined === 'boolean' ? options?.emptyStringAsUndefined : true,
  }) as unknown as ReturnType<typeof createCoreEnv>;
}

/**
 * @deprecated Use the centralized `nextEnv` export instead.
 */
export function makeNextEnv(
  runtimeEnv: NodeJS.ProcessEnv,
  serverSchema: Record<string, z.ZodTypeAny> = serverSchemaBase,
  clientSchema: Partial<Record<`NEXT_PUBLIC_${string}`, z.ZodTypeAny>> = {},
  options?: { skipValidation?: boolean; emptyStringAsUndefined?: boolean },
): ReturnType<typeof createNextEnv> {
  return createNextEnv({
    server: serverSchema,
    client: clientSchema,
    runtimeEnv: runtimeEnv as unknown as Record<string, string | number | boolean | undefined>,
    skipValidation:
      typeof options?.skipValidation === 'boolean'
        ? options?.skipValidation
        : !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined:
      typeof options?.emptyStringAsUndefined === 'boolean' ? options?.emptyStringAsUndefined : true,
  }) as unknown as ReturnType<typeof createNextEnv>;
}

/**
 * @deprecated Not needed anymore with centralized env.
 */
export const processEnv = (env: NodeJS.ProcessEnv): Record<string, string | undefined> =>
  Object.fromEntries(Object.entries(env)) as Record<string, string | undefined>;

export { z };

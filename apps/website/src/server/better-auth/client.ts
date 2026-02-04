import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export type Session = typeof authClient.$Infer.Session;

export const useSession = authClient.useSession;
import type { UserRole } from '@ai-fluency/shared';

/** The authenticated principal attached to every request after the auth hook. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  functionArea: string;
  managerId: string | null;
  groups: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}

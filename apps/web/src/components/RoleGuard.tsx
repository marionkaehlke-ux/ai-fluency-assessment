import { Navigate } from 'react-router-dom';
import { ROLE_PRECEDENCE, type UserRole } from '@ai-fluency/shared';
import type { ReactNode } from 'react';

/** Renders children only if the user's role meets or exceeds `min`; else redirects home. */
export function RoleGuard({
  min,
  role,
  children,
}: {
  min: UserRole;
  role: UserRole;
  children: ReactNode;
}) {
  if (ROLE_PRECEDENCE[role] < ROLE_PRECEDENCE[min]) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

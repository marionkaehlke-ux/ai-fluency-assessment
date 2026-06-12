import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import type { Me } from './types.js';

/** Identity comes from the gateway-authenticated /auth/me endpoint (spec §8.1). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/auth/me') });
}

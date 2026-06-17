import { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Shared Redis connection. Used for the distributed scoring lock (spec §7a.4)
 * and as the BullMQ connection. BullMQ requires maxRetriesPerRequest: null.
 * Null when SCORING_ENABLED=false — Redis is not required in that mode.
 */
export function createRedis(): Redis {
  if (!config.REDIS_URL) throw new Error('REDIS_URL is not set');
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis: Redis | null = config.SCORING_ENABLED ? createRedis() : null;

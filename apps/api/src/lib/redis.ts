import { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Shared Redis connection. Used for the distributed scoring lock (spec §7a.4)
 * and as the BullMQ connection. BullMQ requires maxRetriesPerRequest: null.
 */
export function createRedis(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis = createRedis();

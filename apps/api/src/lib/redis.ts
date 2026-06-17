// Redis removed — scoring is now synchronous (no queue needed for ~300 users).
export const redis = null;
export function createRedis(): never { throw new Error('Redis is not used'); }

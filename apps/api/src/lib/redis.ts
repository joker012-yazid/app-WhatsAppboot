import Redis from 'ioredis';
import env from '../config/env';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null, // Required by BullMQ - must be null
});

redis.on('error', (err) => {
  console.error('[Redis] error', err);
});

export default redis;

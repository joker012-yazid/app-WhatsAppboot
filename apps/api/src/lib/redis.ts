import Redis from 'ioredis';
import env from '../config/env';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

redis.on('error', (err) => {
  console.error('[Redis] error', err);
});

export default redis;

import { RedisOptions } from 'bullmq';

/**
 * Returns connection *options*, not a pre-built ioredis instance. BullMQ
 * only closes a connection on shutdown if it created that connection
 * itself — hand it an instance you built and it assumes you own the
 * lifecycle, which leaves Redis sockets open after shutdown and keeps the
 * process from exiting cleanly. Options let each Queue/Worker/QueueEvents
 * create (and correctly close) its own dedicated connection, which is also
 * what BullMQ recommends: sharing one raw connection across a Worker's
 * blocking commands and a Queue's regular ones isn't safe.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ for any Worker or
 * QueueEvents connection — its blocking commands don't play well with
 * ioredis's default retry behavior.
 */
export function createBullRedisOptions(): RedisOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

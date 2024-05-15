import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { createClient } from 'redis';

import { HSWSError } from './error';
import { logger } from './logger';
import { constants } from './constants';

export type HSWSStoreAuthTokens = Omit<AppEvent.InstallData, 'installedApp'>;

const enum DatabaseKeys {
  PREFIX = 'HSWS',
  INSTALLED_APPS_IDS = 'installedAppsIds',
  DEVICE_EVENTS_IDS = 'deviceEventsIds',
  DEVICE_EVENTS_QUEUE = 'deviceEventsQueue',
  SUBSCRIBED_DEVICES_IDS = 'subscribedDevicesIds',
  AUTHENTICATION_TOKENS = 'authenticationTokens',
}

const DEVICE_EVENTS_TTL = 604800;

const redisClientReconnectStrategy = (retries: number, cause: Error) => {
  if (retries <= 10) {
    logger.warn('Reconnecting', { cause: cause.message });
    return retries * 500;
  }
  logger.error(new HSWSError('Reconnection retries limit exceeded. Connection terminated.', cause));
  return process.exit(1);
};

const redisOnErrorCallback = (error: Error) => {
  logger.error(new HSWSError(`Redis error`, error));
};

let redisClient: ReturnType<typeof createClient>;

try {
  redisClient = await createClient({
    socket: {
      host: constants.HSWS_REDIS_HOST,
      port: +constants.HSWS_REDIS_PORT,
      tls: constants.HSWS_REDIS_TLS_ENABLED === 'true',
      connectTimeout: 10000,
      reconnectStrategy: redisClientReconnectStrategy,
    },
    username: 'default',
    password: constants.HSWS_REDIS_PASSWORD,
    database: +(constants.HSWS_REDIS_DATABASE_NUMBER ?? 0),
  }).connect();

  redisClient.on('error', redisOnErrorCallback);
} catch (e) {
  logger.error(new HSWSError(`Redis connection failed`, e));
  process.exit(1);
}

export const isValidCacheKey = async (cacheKey: string): Promise<boolean> => {
  try {
    return redisClient.sIsMember(
      `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
      cacheKey,
    );
  } catch (e) {
    throw new HSWSError('Failed cache key validation', e);
  }
};

export const initCache = async (
  cacheKey: string,
  authToken: string,
  refreshToken: string,
): Promise<void> => {
  try {
    await Promise.all([
      redisClient.sAdd(`${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`, cacheKey),
      redisClient.hSet(`${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`, {
        authToken,
        refreshToken,
      }),
    ]);
  } catch (e) {
    throw new HSWSError('Failed cache initialization', e);
  }
};

export const clearCache = async (cacheKey: string): Promise<void> => {
  try {
    const deviceEventsKeys: Set<string> = new Set();
    for await (const deviceEventKey of redisClient.scanIterator({
      MATCH: `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:*`,
    })) {
      deviceEventsKeys.add(deviceEventKey);
    }
    await Promise.all([
      redisClient.sRem(`${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`, cacheKey),
      redisClient.unlink([
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`,
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`,
        ...deviceEventsKeys,
      ]),
    ]);
  } catch (e) {
    throw new HSWSError('Failed clearing cache', e);
  }
};

export const addDeviceEvent = async (
  cacheKey: string,
  eventId: string,
  event: ShortEvent,
): Promise<void> => {
  try {
    const cacheKeyKey = `${DatabaseKeys.PREFIX}:${cacheKey}`;
    const eventsIdsKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`;
    const eventHashKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:${eventId}`;
    await Promise.all([
      redisClient.hSet(`${eventHashKey}`, { ...event }),
      redisClient.expire(`${eventHashKey}`, DEVICE_EVENTS_TTL),
      redisClient.sAdd(eventsIdsKey, eventId),
      redisClient.expire(`${eventsIdsKey}`, DEVICE_EVENTS_TTL),
    ]);
  } catch (e) {
    throw new HSWSError('Failed adding new device event', e);
  }
};

export const flushDeviceEvents = async (cacheKey: string): Promise<ShortEvent[]> => {
  try {
    const cacheKeyKey = `${DatabaseKeys.PREFIX}:${cacheKey}`;
    const eventsIdsKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`;
    const eventsQueueKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}`;
    if ((await redisClient.sCard(eventsIdsKey)) === 0) {
      return [];
    }
    const eventsIds: Set<string> = new Set();
    for await (const eventId of redisClient.sScanIterator(eventsIdsKey)) {
      if (typeof eventId === 'string') {
        eventsIds.add(eventId);
      }
    }
    if (eventsIds.size === 0) {
      return [];
    }
    return Promise.all(
      Array.from(eventsIds)
        .filter(async (eventId): Promise<boolean> => {
          if ((await redisClient.exists(`${eventsQueueKey}:${eventId}`)) > 0) {
            return true;
          }
          await redisClient.sRem(eventsIdsKey, eventId);
          return false;
        })
        .map(async (eventId): Promise<ShortEvent> => {
          const [event] = await Promise.all([
            redisClient.hGetAll(`${eventsQueueKey}:${eventId}`) as unknown as Promise<ShortEvent>,
            redisClient.unlink(`${eventsQueueKey}:${eventId}`),
            redisClient.sRem(eventsIdsKey, eventId),
          ]);
          return event;
        }),
    );
  } catch (e) {
    throw new HSWSError('Failed flushing device events', e);
  }
};

export const getSubscribedDevicesIds = async (cacheKey: string): Promise<Set<string>> => {
  try {
    const devicesIds = await redisClient.sMembers(
      `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
    );
    return new Set(devicesIds);
  } catch (e) {
    throw new HSWSError('Failed retrieving subscribed devices ids', e);
  }
};

export const setSubscribedDevicesIds = async (
  cacheKey: string,
  subscribedDevicesIds: Set<string>,
): Promise<void> => {
  try {
    const subIdsKey = `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`;
    await Promise.all([
      redisClient.del(subIdsKey),
      redisClient.sAdd(subIdsKey, Array.from(subscribedDevicesIds)),
    ]);
  } catch (e) {
    throw new HSWSError('Failed storing subscribed devices ids', e);
  }
};

export const getAuthenticationTokens = async (cacheKey: string): Promise<HSWSStoreAuthTokens> => {
  try {
    const { authToken, refreshToken } = await redisClient.hGetAll(
      `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`,
    );
    return { authToken, refreshToken };
  } catch (e) {
    throw new HSWSError('Failed retrieving authentication tokens', e);
  }
};

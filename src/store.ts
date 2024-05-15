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

const redisClientError = (task: string, exception: unknown) =>
  new HSWSError(`RedisClient::${task}`, exception);

let redisClient: ReturnType<typeof createClient>;

try {
  redisClient = await createClient({
    socket: {
      host: constants.HSWS_REDIS_HOST,
      port: +constants.HSWS_REDIS_PORT,
      tls: constants.HSWS_REDIS_TLS_ENABLED === 'true',
      connectTimeout: 10000,
      reconnectStrategy: (retries, cause) => {
        if (retries <= 10) {
          logger.warn('RedisClient: reconnecting', cause);
          return retries * 500;
        }
        logger.error(
          new HSWSError(
            'RedisClient: reconnection retries limit exceeded. Connection terminated.',
            cause,
          ),
        );
        return process.exit(1);
      },
    },
    username: 'default',
    password: constants.HSWS_REDIS_PASSWORD,
    database: +(constants.HSWS_REDIS_DATABASE_NUMBER ?? 0),
  }).connect();

  redisClient.on('error', (error) => {
    logger.error(redisClientError('on(error)', error));
  });
} catch (e) {
  logger.error(redisClientError('connection failed', e));
  process.exit(1);
}

export const isValidCacheKey = async (cacheKey: string): Promise<boolean> => {
  try {
    return redisClient.sIsMember(
      `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
      cacheKey,
    );
  } catch (e) {
    throw redisClientError(isValidCacheKey.name, e);
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
    throw redisClientError(initCache.name, e);
  }
};

export const clearCache = async (cacheKey: string): Promise<void> => {
  try {
    await Promise.all([
      redisClient.sRem(`${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`, cacheKey),
      redisClient.set(`${DatabaseKeys.PREFIX}:${cacheKey}`, '__cleared__', { PX: 1 }),
    ]);
  } catch (e) {
    throw redisClientError(clearCache.name, e);
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
    throw redisClientError(addDeviceEvent.name, e);
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
            redisClient.del(`${eventsQueueKey}:${eventId}`),
            redisClient.sRem(eventsIdsKey, eventId),
          ]);
          return event;
        }),
    );
  } catch (e) {
    throw redisClientError(flushDeviceEvents.name, e);
  }
};

export const getSubscribedDevicesIds = async (cacheKey: string): Promise<Set<string>> => {
  try {
    const devicesIds = await redisClient.sMembers(
      `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
    );
    return new Set(devicesIds);
  } catch (e) {
    throw redisClientError(getSubscribedDevicesIds.name, e);
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
    throw redisClientError(setSubscribedDevicesIds.name, e);
  }
};

export const getAuthenticationTokens = async (cacheKey: string): Promise<HSWSStoreAuthTokens> => {
  try {
    const { authToken, refreshToken } = await redisClient.hGetAll(
      `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`,
    );
    return { authToken, refreshToken };
  } catch (e) {
    throw redisClientError(getAuthenticationTokens.name, e);
  }
};

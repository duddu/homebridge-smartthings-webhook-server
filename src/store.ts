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
  DEVICE_EVENTS_QUEUE = 'deviceEventsQueue',
  SUBSCRIBED_DEVICES_IDS = 'subscribedDevicesIds',
  AUTHENTICATION_TOKENS = 'authenticationTokens',
}

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
    return await redisClient.sIsMember(
      `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
      cacheKey,
    );
  } catch (e) {
    logger.error(redisClientError(isValidCacheKey.name, e));
    throw e;
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
    logger.error(redisClientError(initCache.name, e));
    throw e;
  }
};

export const clearCache = async (cacheKey: string): Promise<void> => {
  try {
    await Promise.all([
      redisClient.sRem(`${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`, cacheKey),
      redisClient.del(`${DatabaseKeys.PREFIX}:${cacheKey}`),
    ]);
  } catch (e) {
    logger.error(redisClientError(clearCache.name, e));
    throw e;
  }
};

export const addDeviceEvent = async (
  cacheKey: string,
  eventId: string,
  event: ShortEvent,
): Promise<void> => {
  try {
    Promise.all([
      redisClient.hSet(
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:${eventId}`,
        {
          ...event,
        },
      ),
      redisClient.expire(
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:${eventId}`,
        86400,
      ),
    ]);
  } catch (e) {
    logger.error(redisClientError(addDeviceEvent.name, e));
    throw e;
  }
};

export const flushDeviceEvents = async (cacheKey: string): Promise<ShortEvent[]> => {
  try {
    const events: ShortEvent[] = [];
    for await (const key of redisClient.scanIterator({
      MATCH: `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:*`,
      COUNT: 1000,
    })) {
      const eventHashKey = await redisClient.get(key);
      if (typeof eventHashKey === 'string') {
        events.push((await redisClient.hGetAll(eventHashKey)) as unknown as ShortEvent);
        await redisClient.del(eventHashKey);
      }
    }
    return events;
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
    await Promise.all([
      redisClient.del(`${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`),
      redisClient.sAdd(
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
        Array.from(subscribedDevicesIds),
      ),
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

import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { createClient } from 'redis';

import { constants } from './constants';
import { HSWSError } from './error';
import { logger } from './logger';

type HSWSStoreAuthTokens = Omit<AppEvent.InstallData, 'installedApp'>;

const enum DatabaseKeys {
  PREFIX = 'HSWS',
  INSTALLED_APPS_IDS = 'installedAppsIds',
  DEVICE_EVENTS_IDS = 'deviceEventsIds',
  DEVICE_EVENTS_QUEUE = 'deviceEventsQueue',
  SUBSCRIBED_DEVICES_IDS = 'subscribedDevicesIds',
  AUTHENTICATION_TOKENS = 'authenticationTokens',
}

const DEVICE_EVENTS_TTL_SEC = 604800;

class HSWSStore {
  public async isValidCacheKey(cacheKey: string): Promise<boolean> {
    try {
      return (await this.redisClient).sIsMember(
        `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
        cacheKey,
      );
    } catch (e) {
      throw new HSWSError('Failed cache key validation', e);
    }
  }

  public async getCacheKeysCount(): Promise<number> {
    try {
      return (await this.redisClient).sCard(
        `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
      );
    } catch (e) {
      throw new HSWSError('Failed getting cache keys count', e);
    }
  }

  public async initCache(cacheKey: string, authToken: string, refreshToken: string): Promise<void> {
    try {
      await Promise.all([
        (await this.redisClient).sAdd(
          `${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`,
          cacheKey,
        ),
        this.setAuthenticationTokens(cacheKey, { authToken, refreshToken }),
      ]);
    } catch (e) {
      throw new HSWSError('Failed cache initialization', e);
    }
  }

  public async clearCache(cacheKey: string): Promise<void> {
    try {
      const deviceEventsKeys: Set<string> = new Set();
      const client = await this.redisClient;
      for await (const deviceEventKey of client.scanIterator({
        MATCH: `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:*`,
      })) {
        deviceEventsKeys.add(deviceEventKey);
      }
      await Promise.all([
        client.sRem(`${DatabaseKeys.PREFIX}:${DatabaseKeys.INSTALLED_APPS_IDS}`, cacheKey),
        client.unlink([
          `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`,
          `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
          `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`,
          ...deviceEventsKeys,
        ]),
      ]);
    } catch (e) {
      throw new HSWSError(`Failed clearing cache for key ${cacheKey}`, e);
    }
  }

  public async addDeviceEvent(cacheKey: string, eventId: string, event: ShortEvent): Promise<void> {
    try {
      const cacheKeyKey = `${DatabaseKeys.PREFIX}:${cacheKey}`;
      const eventsIdsKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`;
      const eventHashKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}:${eventId}`;
      const client = await this.redisClient;
      await Promise.all([
        client.hSet(eventHashKey, { ...event }),
        client.expire(eventHashKey, DEVICE_EVENTS_TTL_SEC),
        client.sAdd(eventsIdsKey, eventId),
        client.expire(eventsIdsKey, DEVICE_EVENTS_TTL_SEC),
      ]);
    } catch (e) {
      throw new HSWSError('Failed adding new device event', e);
    }
  }

  public async flushDeviceEvents(cacheKey: string): Promise<ShortEvent[]> {
    try {
      const cacheKeyKey = `${DatabaseKeys.PREFIX}:${cacheKey}`;
      const eventsIdsKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_IDS}`;
      const eventsQueueKey = `${cacheKeyKey}:${DatabaseKeys.DEVICE_EVENTS_QUEUE}`;
      const client = await this.redisClient;
      if ((await client.sCard(eventsIdsKey)) === 0) {
        return [];
      }
      const eventsIds: Set<string> = new Set();
      for await (const eventId of client.sScanIterator(eventsIdsKey)) {
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
            if ((await client.exists(`${eventsQueueKey}:${eventId}`)) > 0) {
              return true;
            }
            await client.sRem(eventsIdsKey, eventId);
            return false;
          })
          .map(async (eventId): Promise<ShortEvent> => {
            const [event] = await Promise.all([
              client.hGetAll(`${eventsQueueKey}:${eventId}`) as unknown as Promise<ShortEvent>,
              client.unlink(`${eventsQueueKey}:${eventId}`),
              client.sRem(eventsIdsKey, eventId),
            ]);
            return event;
          }),
      );
    } catch (e) {
      throw new HSWSError('Failed flushing device events', e);
    }
  }

  public async getSubscribedDevicesIds(cacheKey: string): Promise<string[]> {
    try {
      const ids = await (
        await this.redisClient
      ).get(`${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`);
      return typeof ids === 'string' && ids.trim() !== '' ? ids.split(';') : [];
    } catch (e) {
      throw new HSWSError('Failed retrieving subscribed devices ids', e);
    }
  }

  public async setSubscribedDevicesIds(cacheKey: string, devicesIds: string[]): Promise<void> {
    try {
      await (
        await this.redisClient
      ).set(
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.SUBSCRIBED_DEVICES_IDS}`,
        devicesIds.join(';'),
      );
    } catch (e) {
      throw new HSWSError('Failed setting subscribed devices ids', e);
    }
  }

  public async getAuthenticationTokens(cacheKey: string): Promise<HSWSStoreAuthTokens> {
    try {
      const { authToken, refreshToken } = await (
        await this.redisClient
      ).hGetAll(`${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`);
      return { authToken, refreshToken };
    } catch (e) {
      throw new HSWSError('Failed retrieving authentication tokens', e);
    }
  }

  public async setAuthenticationTokens(
    cacheKey: string,
    authTokens: HSWSStoreAuthTokens,
  ): Promise<void> {
    try {
      await (
        await this.redisClient
      ).hSet(
        `${DatabaseKeys.PREFIX}:${cacheKey}:${DatabaseKeys.AUTHENTICATION_TOKENS}`,
        authTokens,
      );
    } catch (e) {
      throw new HSWSError('Failed setting authentication tokens', e);
    }
  }

  public async isRedisClientReady(): Promise<boolean> {
    try {
      return (await this.redisClient).isReady;
    } catch (e) {
      return false;
    }
  }

  private _redisClient: Promise<ReturnType<typeof createClient>> | undefined;

  private get redisClient(): Promise<ReturnType<typeof createClient>> {
    if (typeof this._redisClient !== 'undefined') {
      return this._redisClient;
    }

    this._redisClient = createClient({
      socket: {
        host: constants.HSWS_REDIS_HOST,
        port: +constants.HSWS_REDIS_PORT,
        tls: constants.HSWS_REDIS_TLS_ENABLED === 'true',
        connectTimeout: 10000,
        reconnectStrategy: this.redisClientReconnectStrategy,
      },
      username: 'default',
      password: constants.HSWS_REDIS_PASSWORD,
      database: +(constants.HSWS_REDIS_DATABASE_NUMBER ?? 0),
    }).connect();

    this._redisClient
      .then((client) => {
        client.on('error', this.redisErrorCallback);
        client.on('connect', this.getRedisEventDefaultCallback('connect'));
        client.on('ready', this.getRedisEventDefaultCallback('ready'));
        client.on('end', this.getRedisEventDefaultCallback('end'));
      })
      .catch((e) => {
        logger.error(new HSWSError(`Redis connection failed`, e));
      });

    return this._redisClient;
  }

  private redisClientReconnectStrategy(retries: number, cause: Error) {
    if (retries <= 15) {
      logger.warn('Reconnecting', { cause: cause.message });
      return retries * 2000;
    }
    logger.error(
      new HSWSError('Reconnection retries limit exceeded. Connection terminated.', cause),
    );
    return false;
  }

  private redisErrorCallback(error: Error) {
    logger.error(new HSWSError(`Redis error`, error));
  }

  private getRedisEventDefaultCallback(eventName: string): () => void {
    return function redisEventDefaultCallback() {
      logger.debug(`Received ${eventName} event from redis client`);
    };
  }
}

export const store = new HSWSStore();

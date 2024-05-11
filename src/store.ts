import { SubscriptionsEndpoint } from '@smartthings/core-sdk';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import NodeCache from 'node-cache';

import { HSWSError } from './error';
import { logger } from './logger';

const EVENTS_CACHE_TTL = 86400;
const SUBSCRIPTION_CACHE_TTL = 0;

export class HSWSEventsQueue extends Set<ShortEvent> {}

export class HSWSSubscriptionsContext {
  public readonly subscribedDevicesIds = new Set<string>();

  constructor(
    public readonly installedAppId: string,
    public readonly subscriptionsEndpoint: SubscriptionsEndpoint,
  ) {}
}

interface HSWSICache<V> {
  get<V>(key: string): V | undefined;
  set(key: string, value: V): boolean;
}

class HSWSCache<V> extends NodeCache implements HSWSICache<V> {
  constructor(stdTTL: number) {
    super({
      stdTTL,
      checkperiod: stdTTL / 24,
      useClones: false,
    });
  }

  public chillSet = (key: string, value: V): boolean | undefined => {
    if (this.has(key)) {
      return undefined;
    }
    logger.debug(`HSWSCache::chillSet(): Cache for key ${key} is missing, setting it now`);
    return this.set(key, value);
  };
}

class HSWSEventsQueuesCache extends HSWSCache<HSWSEventsQueue> {}

class HSWSSubscriptionsContextsCache extends HSWSCache<HSWSSubscriptionsContext> {}

class HSWSStore {
  private readonly eventsQueues: HSWSEventsQueuesCache;
  private readonly subscriptionsContexts: HSWSSubscriptionsContextsCache;

  constructor() {
    this.eventsQueues = new HSWSEventsQueuesCache(EVENTS_CACHE_TTL);
    this.subscriptionsContexts = new HSWSSubscriptionsContextsCache(SUBSCRIPTION_CACHE_TTL);
  }

  public initCache = (cacheKey: string, subscriptionsEndpoint: SubscriptionsEndpoint): void => {
    try {
      if (!this.eventsQueues.set(cacheKey, new HSWSEventsQueue())) {
        throw HSWSEventsQueuesCache.name;
      }
      if (
        !this.subscriptionsContexts.set(
          cacheKey,
          new HSWSSubscriptionsContext(cacheKey, subscriptionsEndpoint),
        )
      ) {
        throw HSWSSubscriptionsContextsCache.name;
      }
    } catch (failedCacheName) {
      const message = `Failed to initialize ${failedCacheName} for key ${cacheKey}`;
      logger.error(`HSWSStore::initOrEnsureCache(): ${message}`, { subscriptionsEndpoint });
      throw new HSWSError(message);
    }
    logger.debug(`HSWSStore::initCache(): Initialized store caches for key ${cacheKey}`);
  };

  public ensureCache = async (
    cacheKey: string,
    subscriptionsEndpoint: SubscriptionsEndpoint,
  ): Promise<void> => {
    try {
      if (this.eventsQueues.chillSet(cacheKey, new HSWSEventsQueue()) === false) {
        throw HSWSEventsQueuesCache.name;
      }
      const subContextSet = this.subscriptionsContexts.chillSet(
        cacheKey,
        new HSWSSubscriptionsContext(cacheKey, subscriptionsEndpoint),
      );
      if (subContextSet === false) {
        throw HSWSSubscriptionsContextsCache.name;
      }
      if (subContextSet === true) {
        await subscriptionsEndpoint.delete();
      }
    } catch (failedCacheName) {
      const message = `Failed to initialize ${failedCacheName} for key ${cacheKey}`;
      logger.error(`HSWSStore::initOrEnsureCache(): ${message}`, { subscriptionsEndpoint });
      throw new HSWSError(message);
    }
    logger.debug(`HSWSStore::ensureCache(): Ensured store caches for key ${cacheKey}`);
  };

  public clearCache = (cacheKey: string): void => {
    try {
      const failedCacheNames: string[] = [];
      if (this.eventsQueues.del(cacheKey) !== 1) {
        failedCacheNames.push(HSWSEventsQueuesCache.name);
      }
      if (this.subscriptionsContexts.del(cacheKey) !== 1) {
        failedCacheNames.push(HSWSSubscriptionsContextsCache.name);
      }
      if (failedCacheNames.length > 0) {
        throw failedCacheNames;
      }
    } catch (failedCacheNames) {
      for (const cacheName of failedCacheNames as string[]) {
        logger.warn(`HSWSStore::clearCache(): Unable to delete ${cacheName} for key ${cacheKey}`);
      }
      return;
    }
    logger.debug(`HSWSStore::clearCache(): Deleted store caches for key ${cacheKey}`);
  };

  public addEvent = (cacheKey: string, event: ShortEvent): void => {
    this.getEvents(cacheKey).add(event);
  };

  public getEvents = (cacheKey: string) =>
    this.getCachedValue(this.eventsQueues, cacheKey, HSWSEventsQueue);

  public getSubscriptionsContext = (cacheKey: string) =>
    this.getCachedValue(this.subscriptionsContexts, cacheKey, HSWSSubscriptionsContext);

  private getCachedValue = <
    C extends { new (...args: never[]): V; prototype: V },
    V = C['prototype'],
  >(
    cache: NodeCache,
    key: string,
    constructor: C,
  ): V => {
    const value = cache.get<V>(key);
    if (!(value instanceof constructor)) {
      throw new HSWSError(`${constructor.name} not initialized for cache key ${key}`);
    }
    return value;
  };

  public getStats = (): { [C: string]: NodeCache.Stats } => ({
    [HSWSEventsQueuesCache.name]: this.eventsQueues.getStats(),
    [HSWSSubscriptionsContextsCache.name]: this.subscriptionsContexts.getStats(),
  });
}

export const store = new HSWSStore();

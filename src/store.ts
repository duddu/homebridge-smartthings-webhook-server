import { SubscriptionsEndpoint } from '@smartthings/core-sdk';
import { ConstructorArgs } from 'homebridge';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import NodeCache from 'node-cache';

import { logger } from './logger';

const EVENTS_CACHE_TTL = 86400;
const SUBSCRIPTION_CACHE_TTL = 0;

export class HSWSEventsQueue extends Set<ShortEvent> {}

export class HSWSSubscriptionsContext {
  constructor(
    public readonly installedAppId: string,
    public readonly subscriptionsEndpoint: SubscriptionsEndpoint,
  ) {}

  public readonly subscribedDevicesIds = new Set<string>();
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

  public initCache = (
    cacheKey: string,
    ...subscriptionsContext: ConstructorArgs<typeof HSWSSubscriptionsContext>
  ): void => {
    try {
      if (!this.eventsQueues.set(cacheKey, new HSWSEventsQueue())) {
        throw HSWSEventsQueuesCache.name;
      }
      if (
        !this.subscriptionsContexts.set(
          cacheKey,
          new HSWSSubscriptionsContext(...subscriptionsContext),
        )
      ) {
        throw HSWSSubscriptionsContextsCache.name;
      }
    } catch (failedCacheName) {
      const message = `Unable to set initialize ${failedCacheName} for key ${cacheKey}`;
      logger.error(`HSWSStore::initCacheKey(): ${message}`, { ...subscriptionsContext });
      throw new Error(message);
    }
  };

  public clearCache = (cacheKey: string): void => {
    this.eventsQueues.del(cacheKey);
    this.subscriptionsContexts.del(cacheKey);
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
      throw new Error(`${constructor.name} not initialized for cache key ${key}`);
    }
    return value;
  };
}

export const store = new HSWSStore();

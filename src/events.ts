import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import NodeCache from 'node-cache';

const enum CacheKeys {
  ID = 'id',
  EVENTS = 'events',
}

class HSWSEventsCaches {
  private readonly caches: Map<string, HSWSEventsCache> = new Map();

  public getCache(cacheId: string): HSWSEventsCache {
    if (this.caches.has(cacheId)) {
      return this.caches.get(cacheId)!;
    }
    const cache = new HSWSEventsCache(cacheId);
    this.caches.set(cacheId, cache);
    return cache;
  }

  public addEvent(event: AppEvent.DeviceEvent): void {
    for (const cache of this.caches.values()) {
      let events = cache.getEvents();
      if (!Array.isArray(events)) {
        cache.resetEvents();
        events = cache.getEvents()!;
      }
      events.push(this.shortenEvent(event));
    }
  }

  private shortenEvent = ({
    deviceId,
    value,
    componentId,
    capability,
    attribute,
  }: AppEvent.DeviceEvent): ShortEvent => ({
    deviceId,
    value,
    componentId,
    capability,
    attribute,
  });
}

class HSWSEventsCache {
  private readonly cache: NodeCache;

  constructor(readonly cacheId: string) {
    const cache = new NodeCache({
      stdTTL: 86400,
      checkperiod: 1800,
      useClones: false,
    });
    if (cache.set<string>(CacheKeys.ID, cacheId) === false) {
      throw new Error('Unable to set new cache id');
    }
    this.cache = cache;
  }

  public flushEvents(): ShortEvent[] {
    const events = this.getEvents();
    this.resetEvents();
    return Array.isArray(events) ? events : [];
  }

  public getEvents(): ShortEvent[] | undefined {
    return this.cache.get<ShortEvent[]>(CacheKeys.EVENTS);
  }

  public resetEvents(): void {
    if (this.cache.set<ShortEvent[]>(CacheKeys.EVENTS, []) === false) {
      throw new Error('Unable to set new events list in cache');
    }
  }
}

export const eventsCaches = new HSWSEventsCaches();

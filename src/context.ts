import { ContextRecord, SmartAppContext } from '@smartthings/smartapp';
import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import NodeCache from 'node-cache';

import { logger } from './logger';
import { smartApp } from './smartapp';

export type HSWSSmartAppContextsCacheItem = {
  context: SmartAppContext;
  subscribedDevicesIds: Set<string>;
};

class HSWSSmartAppContextsCache {
  private readonly contexts: NodeCache;

  constructor() {
    this.contexts = new NodeCache({
      stdTTL: 0,
      checkperiod: 0,
      useClones: false,
    });
  }

  public async put({ installedApp, authToken, refreshToken }: AppEvent.InstallData): Promise<void> {
    const { installedAppId } = installedApp;
    try {
      const contextRecord: ContextRecord = {
        installedAppId,
        authToken,
        refreshToken,
      };
      const context = await smartApp.withContext(contextRecord);
      const subscriptions = await context.api.subscriptions.list();
      const subscribedDevicesIds = new Set<string>(
        subscriptions
          .map(({ device }) => device?.deviceId)
          .filter((deviceId): deviceId is string => typeof deviceId === 'string'),
      );
      if (
        !this.contexts.set<HSWSSmartAppContextsCacheItem>(installedAppId, {
          context,
          subscribedDevicesIds,
        })
      ) {
        throw new Error(`Unable to set the value for cache key ${installedAppId}`);
      }
      logger.debug(`Stored smart app context for installedAppId ${installedAppId}`, {
        subscribedDevicesIdsSize: subscribedDevicesIds.size,
      });
    } catch (error) {
      logger.error(
        `Unable to store smart app context for installedAppId ${installedAppId}. ` +
          'The app will not receive devices events, please try to reinstall it from SmartThings.',
        error,
      );
    }
  }

  public getAllContexts(): HSWSSmartAppContextsCacheItem[] {
    const contextsKeys = this.contexts.keys();
    logger.silly('Getting all smart app contexts', { contextsKeys });
    return Object.values(this.contexts.mget<HSWSSmartAppContextsCacheItem>(contextsKeys));
  }
}

export const contextsCache = new HSWSSmartAppContextsCache();

import { ContextRecord, ContextStore, SmartAppContext } from '@smartthings/smartapp';
import NodeCache from 'node-cache';

import { logger } from './logger';
import { smartApp } from './smartapp';

class HSWSSmartAppContextStore implements ContextStore {
  private readonly contexts = new NodeCache({
    stdTTL: 604800, // @TODO verify context recreation
    checkperiod: 43200,
    useClones: false,
  });

  public async get(installedAppId: string): Promise<ContextRecord> {
    if (!this.contexts.has(installedAppId)) {
      const message = `Unable to get stored context for installedAppId ${installedAppId}`;
      logger.error(message);
      return Promise.reject(message);
    }
    return Promise.resolve(this.contexts.get(installedAppId)!);
  }

  public async put(contextRecord: ContextRecord): Promise<ContextRecord> {
    const { installedAppId } = contextRecord;
    if (!this.contexts.set(installedAppId, contextRecord)) {
      const message = `Unable to store context for installedAppId ${installedAppId}`;
      logger.error(message);
      return Promise.reject(message);
    }
    return Promise.resolve(this.contexts.get(installedAppId)!);
  }

  public async getAllSmartAppContexts(): Promise<SmartAppContext[]> {
    return (
      await Promise.allSettled(
        this.contexts
          .keys()
          .map((installedAppId) =>
            smartApp.withContext(this.contexts.get<ContextRecord>(installedAppId)!),
          ),
      )
    )
      .filter((result): result is PromiseFulfilledResult<SmartAppContext> => {
        if (result.status === 'fulfilled') {
          return true;
        }
        logger.error('Unable to resolve smart app context', result.reason);
        return false;
      })
      .map(({ value }) => value);
  }
}

export const contextStore = new HSWSSmartAppContextStore();

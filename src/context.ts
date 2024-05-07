import { ContextRecord, SmartAppContext } from '@smartthings/smartapp';
import NodeCache from 'node-cache';

import { logger } from './logger';
import { smartApp } from './smartapp';

class HSWSSmartAppContextStore {
  private readonly contexts: NodeCache;

  constructor() {
    this.contexts = new NodeCache({
      stdTTL: 0,
      checkperiod: 0,
      useClones: true,
    });
  }

  public put(contextRecord: ContextRecord): void {
    const { installedAppId } = contextRecord;
    if (!this.contexts.set(installedAppId, contextRecord)) {
      const message = `Unable to store context for installedAppId ${installedAppId}`;
      logger.error(message);
      throw new Error(message);
    }
  }

  public async getAllSmartAppContexts(): Promise<SmartAppContext[]> {
    logger.debug('Getting all smart app contexts', { contextsKeys: this.contexts.keys() });
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

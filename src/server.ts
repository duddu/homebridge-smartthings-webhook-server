import compression from 'compression';
import express from 'express';

import { constants } from './constants';
import { logger } from './logger';
import {
  clientRequestMiddleware,
  healthMiddleware,
  rateLimitMiddleware,
  smartAppWebhookMiddleware,
  storeStatsMiddleware,
  versionMiddleware,
  webhookTokenMiddleware,
} from './middleware';
import { store } from './store';

const enum HSWSRoutes {
  HEALTH = '/healthz',
  VERSION = '/version',
  STORE_STATS = '/store-stats',
  WEBHOOK_API = '/api',
  WEBHOOK_CLIENT = `${WEBHOOK_API}/clientrequest`,
}

const listenCallback = async (): Promise<void> => {
  logger.info(`Server listening on port ${constants.HSWS_PORT}`, {
    logLevel: constants.HSWS_LOG_LEVEL,
    version: constants.HSWS_VERSION,
    revision: constants.HSWS_REVISION,
    redisReady: await store.isRedisClientReady(),
  });
};

export const server = express()
  .get(HSWSRoutes.HEALTH, healthMiddleware)
  .get(HSWSRoutes.VERSION, versionMiddleware)
  .get(HSWSRoutes.STORE_STATS, storeStatsMiddleware)
  .use(express.json())
  .use(compression({ level: 6, threshold: 500 }))
  .post(HSWSRoutes.WEBHOOK_API, smartAppWebhookMiddleware)
  .post(
    HSWSRoutes.WEBHOOK_CLIENT,
    webhookTokenMiddleware,
    rateLimitMiddleware,
    clientRequestMiddleware,
  )
  .disable('x-powered-by')
  .listen(constants.HSWS_PORT, listenCallback);

server.keepAliveTimeout = 120000;

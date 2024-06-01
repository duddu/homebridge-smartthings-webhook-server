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

const enum HSWSPaths {
  PATH_HEALTH = '/healthz',
  PATH_VERSION = '/version',
  STATS_VERSION = '/store-stats',
  PATH_API = '/api',
  PATH_CLIENTREQUEST = `${PATH_API}/clientrequest`,
}

const listenCallback = (): void => {
  logger.info(`Server listening on port ${constants.HSWS_PORT}`, {
    logLevel: constants.HSWS_LOG_LEVEL,
    version: constants.HSWS_VERSION,
    revision: constants.HSWS_REVISION,
  });
};

export const server = express()
  .get(HSWSPaths.PATH_HEALTH, healthMiddleware)
  .get(HSWSPaths.PATH_VERSION, versionMiddleware)
  .get(HSWSPaths.STATS_VERSION, storeStatsMiddleware)
  .use(express.json())
  .use(compression({ level: 6, threshold: 500 }))
  .post(HSWSPaths.PATH_API, smartAppWebhookMiddleware)
  .post(
    HSWSPaths.PATH_CLIENTREQUEST,
    webhookTokenMiddleware,
    rateLimitMiddleware,
    clientRequestMiddleware,
  )
  .disable('x-powered-by')
  .listen(constants.HSWS_PORT, listenCallback);

server.keepAliveTimeout = 120000;

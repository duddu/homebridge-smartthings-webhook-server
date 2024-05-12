import express from 'express';
import compression from 'compression';

import { constants } from './constants';
import { logger } from './logger';
import {
  cacheStatsMiddleware,
  clientRequestMiddleware,
  healthMiddleware,
  rateLimitMiddleware,
  smartAppWebhookMiddleware,
  versionMiddleware,
  webhookTokenMiddleware,
} from './middleware';

const PATH_HEALTH = '/healthz';
const PATH_VERSION = '/version';
const PATH_CACHE_STATS = '/cache-stats';
const PATH_API = '/api';
const PATH_CLIENTREQUEST = `${PATH_API}/clientrequest`;

const listenCallback = (): void => {
  logger.info(`Server listening on port ${constants.HSWS_PORT}`, {
    logLevel: constants.HSWS_LOG_LEVEL,
    version: constants.HSWS_VERSION,
    revision: constants.HSWS_REVISION,
  });
};

export const server = express()
  .get(PATH_HEALTH, healthMiddleware)
  .use(compression({ level: 6, threshold: 10 }))
  .get(PATH_VERSION, versionMiddleware)
  .get(PATH_CACHE_STATS, cacheStatsMiddleware)
  .use(express.json())
  .use(compression({ level: 6, threshold: 500 }))
  .post(PATH_API, smartAppWebhookMiddleware)
  .post(PATH_CLIENTREQUEST, webhookTokenMiddleware, rateLimitMiddleware, clientRequestMiddleware)
  .disable('x-powered-by')
  .listen(constants.HSWS_PORT, listenCallback);

server.keepAliveTimeout = 120000;

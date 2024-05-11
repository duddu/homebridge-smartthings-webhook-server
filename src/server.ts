import express from 'express';

import { constants } from './constants';
import { logger } from './logger';
import {
  clientRequestMiddleware,
  healthMiddleware,
  rateLimitMiddleware,
  smartAppWebhookMiddleware,
  versionMiddleware,
  webhookTokenMiddleware,
} from './middleware';

const PATH_HEALTH = '/healthz';
const PATH_VERSION = '/version';
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
  .get(PATH_VERSION, versionMiddleware)
  .use(express.json())
  .post(PATH_API, smartAppWebhookMiddleware)
  .post(PATH_CLIENTREQUEST, webhookTokenMiddleware, rateLimitMiddleware, clientRequestMiddleware)
  .listen(constants.HSWS_PORT, listenCallback);

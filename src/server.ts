import express from 'express';

import { constants } from './constants';
import { logger } from './logger';
import {
  authTokenMiddleware,
  clientRequestMiddleware,
  healthMiddleware,
  rateLimitMiddleware,
  versionMiddleware,
  webhookMiddleware,
} from './middlewares';

const PATH_HEALTH = '/healthz';
const PATH_VERSION = '/version';
const PATH_API = '/api';
const PATH_CLIENTREQUEST = `${PATH_API}/clientrequest`;

export const server = express()
  .get(PATH_HEALTH, healthMiddleware)
  .get(PATH_VERSION, versionMiddleware)
  .use(express.json())
  .post(PATH_API, webhookMiddleware)
  .post(PATH_CLIENTREQUEST, authTokenMiddleware, rateLimitMiddleware, clientRequestMiddleware)
  .listen(constants.HSWS_PORT, () =>
    logger.info(`HSWS server ready`, {
      port: constants.HSWS_PORT,
      logLevel: constants.HSWS_LOG_LEVEL,
      version: constants.HSWS_VERSION,
      revision: constants.HSWS_REVISION,
    }),
  );

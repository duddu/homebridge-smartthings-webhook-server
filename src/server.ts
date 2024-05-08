import express from 'express';

import { constants } from './constants';
import { logger } from './logger';
import {
  authTokenMiddleware,
  clientRequestMiddleware,
  healthMiddleware,
  logPathnameMiddleware,
  rateLimitMiddleware,
  webhookMiddleware,
} from './middleware';

const PORT = constants.HSWS_PORT;
const PATH_HEALTH = '/healthz';
const PATH_API = '/api';
const PATH_CLIENTREQUEST = `${PATH_API}/clientrequest`;

export const server = express()
  .use(logPathnameMiddleware)
  .get(PATH_HEALTH, healthMiddleware)
  .use(express.json())
  .post(PATH_API, webhookMiddleware)
  .post(PATH_CLIENTREQUEST, authTokenMiddleware, rateLimitMiddleware, clientRequestMiddleware)
  .listen(PORT, () => logger.info(`Server is up and running on port ${PORT}`));

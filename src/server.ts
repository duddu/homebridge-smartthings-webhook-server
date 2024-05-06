import express, { RequestHandler } from 'express';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';

import { devices } from './devices';
import { eventsCaches } from './events';
import { logger } from './logger';
import { smartApp } from './smartapp';

const PORT = process.env.PORT; // @TODO throw if no env var
const PATH_HEALTH = '/healthz';
const PATH_API = '/api';
const PATH_CLIENTREQUEST = `/${PATH_API}/clientrequest`;

const healthMiddleware: RequestHandler = (_req, res) => {
  res.sendStatus(200);
};

const webhookMiddleware: RequestHandler = (req, res) => {
  smartApp.handleHttpCallback(req, res);
};

const clientrequestMiddleware: RequestHandler<never, ResponseBody, RequestBody> = async (
  req,
  res,
) => {
  const bearer = req.header('Authorization')?.replace('Bearer:', '').trim();
  if (typeof bearer !== 'string' || bearer === '') {
    logger.error('Unable to retrieve bearer token from request headers');
    res.sendStatus(401);
    return;
  }

  await devices.subscribeToIds(req.body.deviceIds);

  const events = eventsCaches.getCache(bearer).flushEvents();
  res.status(200).json({ timeout: false, events });
};

const logPathnameMiddleware: RequestHandler = (req, _res, next) => {
  logger.silly(`Handling ${req.url}`);
  next();
};

export const server = express()
  .use(logPathnameMiddleware)
  .get(PATH_HEALTH, healthMiddleware)
  .use(express.json())
  .post(PATH_API, webhookMiddleware)
  .post(PATH_CLIENTREQUEST, clientrequestMiddleware)
  .listen(PORT, () => logger.info(`Server is up and running on port ${PORT}.`));

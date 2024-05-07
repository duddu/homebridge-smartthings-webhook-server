import { RequestHandler } from 'express';
import { slowDown } from 'express-slow-down';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';

import { devices } from './devices';
import { eventsCaches } from './events';
import { logger } from './logger';
import { smartApp } from './smartapp';

interface HSWSExpressLocals extends Record<string, unknown> {
  authToken: string;
}

type HSWSClientRequestHandler = RequestHandler<
  never,
  ResponseBody,
  RequestBody,
  never,
  HSWSExpressLocals
>;

export const logPathnameMiddleware: RequestHandler = (req, _res, next) => {
  logger.silly(`Handling ${req.url}`);
  next();
};

export const healthMiddleware: RequestHandler = (_req, res) => {
  res.sendStatus(200);
};

export const webhookMiddleware: RequestHandler = (req, res) => {
  smartApp.handleHttpCallback(req, res);
};

export const authTokenMiddleware: HSWSClientRequestHandler = (req, res, next) => {
  const bearer = req.header('Authorization')?.replace('Bearer:', '').trim();

  if (typeof bearer !== 'string' || bearer === '') {
    logger.error('Unable to retrieve bearer token from request headers');
    res.sendStatus(401);
    return;
  }

  res.locals.authToken = bearer;

  next();
};

export const rateLimitMiddleware = slowDown({
  windowMs: 5000,
  delayAfter: 1,
  delayMs: (hits) => hits * 300,
  maxDelayMs: 1200,
  skipFailedRequests: true,
  validate: { xForwardedForHeader: false },
  keyGenerator: (_req, res) => (res.locals as HSWSExpressLocals).authToken,
});

export const clientRequestMiddleware: HSWSClientRequestHandler = async (req, res) => {
  await devices.subscribeAllInstalledApps(req.body.deviceIds);

  const events = eventsCaches.getCache(res.locals.authToken).flushEvents();

  res.status(200).json({ timeout: false, events });
};

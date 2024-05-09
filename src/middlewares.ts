import { RequestHandler } from 'express';
import { slowDown } from 'express-slow-down';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';

import { constants } from './constants';
import { subscribeInstalledApps } from './devices';
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

export const healthMiddleware: RequestHandler = (_req, res) => {
  res.sendStatus(200);
};

export const versionMiddleware: RequestHandler = (_req, res) => {
  res.status(200).json({
    version: constants.HSWS_VERSION,
    revision: constants.HSWS_REVISION,
    smartAppId: constants.STSA_SMART_APP_ID,
  });
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
  windowMs: 2000,
  delayAfter: 1,
  delayMs: (hits) => hits * 200,
  maxDelayMs: 800,
  skipFailedRequests: true,
  validate: { xForwardedForHeader: false },
  keyGenerator: (_req, res) => (res.locals as HSWSExpressLocals).authToken,
});

export const clientRequestMiddleware: HSWSClientRequestHandler = async (req, res) => {
  const events = eventsCaches.getCache(res.locals.authToken).flushEvents();

  await subscribeInstalledApps(new Set(req.body.deviceIds));

  res.status(200).json({ timeout: false, events });
};

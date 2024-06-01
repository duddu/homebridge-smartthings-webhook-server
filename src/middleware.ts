import { RequestHandler } from 'express';
import { slowDown } from 'express-slow-down';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';

import { constants } from './constants';
import { logger } from './logger';
import { smartApp } from './smartapp';
import { store } from './store';
import { syncDevicesSubscriptions } from './subscriptions';

interface HSWSExpressLocals extends Record<string, unknown> {
  webhookToken: string;
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

export const storeStatsMiddleware: RequestHandler = async (_req, res) => {
  try {
    res.status(200).json({
      installedAppsCount: await store.getCacheKeysCount(),
    });
  } catch (error) {
    logger.error(error);

    res.sendStatus(500);
  }
};

export const versionMiddleware: RequestHandler = (_req, res) => {
  res.status(200).json({
    version: constants.HSWS_VERSION,
    revision: constants.HSWS_REVISION,
    smartAppId: constants.STSA_SMART_APP_ID,
  });
};

export const smartAppWebhookMiddleware: RequestHandler = (req, res) => {
  smartApp.handleHttpCallback(req, res);
};

export const webhookTokenMiddleware: HSWSClientRequestHandler = async (req, res, next) => {
  const bearer = req.get('Authorization')?.replace('Bearer:', '').trim();

  if (typeof bearer !== 'string' || bearer === '') {
    logger.error('Unable to retrieve webhook token from request headers');
    res.sendStatus(401);
    return;
  }

  try {
    if (!(await store.isValidCacheKey(bearer))) {
      logger.error('The webhook token provided does not match any installed application id');
      res.sendStatus(403);
      return;
    }
  } catch (e) {
    logger.error('Unable to validate request webhook token');
    res.sendStatus(403);
    return;
  }

  res.locals.webhookToken = bearer;

  next();
};

export const rateLimitMiddleware = slowDown({
  windowMs: 2000,
  delayAfter: 2,
  delayMs: (hits) => hits * 150,
  maxDelayMs: 500,
  skipFailedRequests: true,
  validate: { xForwardedForHeader: false },
  keyGenerator: (_req, res) => (res.locals as HSWSExpressLocals).webhookToken,
});

export const clientRequestMiddleware: HSWSClientRequestHandler = async (req, res) => {
  const { deviceIds, timeout } = req.body;

  if (!Array.isArray(deviceIds)) {
    const message = 'Request body deviceIds field absent or malformed';
    logger.error(message, { deviceIds });

    res.status(400).end(message);

    return;
  }

  if (typeof timeout !== 'number') {
    const message = 'Request body timeout field absent or malformed';
    logger.error(message, { timeout });

    res.status(400).end(message);

    return;
  }

  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(200).json({ timeout: true, events: [] });
    }
  });

  const reqKeepAlive = req.get('Keep-Alive');

  if (typeof reqKeepAlive === 'string' && reqKeepAlive.trim() !== '') {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', reqKeepAlive.trim());
  }

  try {
    const { webhookToken } = res.locals;

    await syncDevicesSubscriptions(webhookToken, deviceIds);

    const events = await store.flushDeviceEvents(webhookToken);

    logger.silly('Sending response', { events, headers: res.getHeaders() });

    res.status(200).json({ timeout: false, events });
  } catch (error) {
    logger.error(error);

    res.status(500);
    if (error instanceof Error && typeof error.message === 'string') {
      res.statusMessage = error.message;
    }
    res.end();
  }
};

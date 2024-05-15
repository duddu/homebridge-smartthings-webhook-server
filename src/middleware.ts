import { RequestHandler } from 'express';
import { slowDown } from 'express-slow-down';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { stringify } from 'safe-stable-stringify';

import { constants } from './constants';
import { flushDeviceEvents, isValidCacheKey } from './store';
import { logger } from './logger';
import { smartApp } from './smartapp';
import { ensureSubscriptions } from './subscriptions';

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
    if (!(await isValidCacheKey(bearer))) {
      logger.error('The webhook token present in the request is not valid');
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

    await ensureSubscriptions(webhookToken, deviceIds);

    const events = await flushDeviceEvents(webhookToken);

    res.status(200).json({ timeout: false, events });
  } catch (e) {
    logger.error(e);

    res.status(500).end(e instanceof Error ? e.message : stringify(e));

    return;
  }
};

import { RequestHandler } from 'express';
import { slowDown } from 'express-slow-down';
import {
  RequestBody,
  ResponseBody,
} from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { stringify } from 'safe-stable-stringify';

import { constants } from './constants';
import { ensureSubscriptions } from './subscriptions';
import { flushDevicesEvents } from './events';
import { logger } from './logger';
import { smartApp } from './smartapp';

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

export const webhookTokenMiddleware: HSWSClientRequestHandler = (req, res, next) => {
  const bearer = req.get('Authorization')?.replace('Bearer:', '').trim();

  if (typeof bearer !== 'string' || bearer === '') {
    logger.error('Unable to retrieve bearer token from request headers');
    res.sendStatus(401);
    return;
  }

  res.locals.webhookToken = bearer;

  next();
};

export const rateLimitMiddleware = slowDown({
  windowMs: 2000,
  delayAfter: 1,
  delayMs: (hits) => hits * 200,
  maxDelayMs: 800,
  skipFailedRequests: true,
  validate: { xForwardedForHeader: false },
  keyGenerator: (_req, res) => (res.locals as HSWSExpressLocals).webhookToken,
});

export const clientRequestMiddleware: HSWSClientRequestHandler = async (req, res) => {
  const { webhookToken } = res.locals;
  const { deviceIds } = req.body;

  if (!Array.isArray(deviceIds)) {
    const message = 'Request body deviceIds field absent or malformed';
    logger.error(`clientRequestMiddleware(): ${message}`, { deviceIds });

    res.status(400).write(message);
    res.end();

    return;
  }

  try {
    await ensureSubscriptions(webhookToken, deviceIds);

    const events = flushDevicesEvents(webhookToken);

    res.status(200).json({ timeout: false, events }); // @TODO keep-alive and timeout
  } catch (e) {
    logger.error(e);

    res.status(500).write(e instanceof Error ? e.message : stringify(e));
    res.end();

    return;
  }
};

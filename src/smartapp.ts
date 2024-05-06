import { SmartApp } from '@smartthings/smartapp';

import { eventsCaches } from './events';
import { logger, smartAppLogger } from './logger';

export const DEVICE_EVENT_HANDLER_NAME = 'HSWSDeviceEventHandler';

export const smartApp = new SmartApp()
  .configureLogger(smartAppLogger)
  .enableEventLogging(2)
  .appId(process.env.SMART_APP_ID!) // @TODO throw if no env var
  .permissions(['r:devices:*', 'r:locations:*'])
  .page('mainPage', () => {})
  .installed(async (context) => {
    logger.debug('SmartApp installed');
    await context.api.subscriptions.delete();
  })
  .subscribedDeviceEventHandler(DEVICE_EVENT_HANDLER_NAME, (_context, event) => {
    logger.debug('Device event received', event);
    eventsCaches.addEvent(event);
  });

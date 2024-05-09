import { SmartApp } from '@smartthings/smartapp';

import { constants } from './constants';
import { contextsCache } from './contexts';
import { eventsCaches } from './events';
import { logger, smartAppLogger } from './logger';

export const DEVICE_EVENT_HANDLER_NAME = 'HSWSDeviceEventHandler';

export const smartApp = new SmartApp()
  .configureLogger(smartAppLogger)
  .enableEventLogging(2)
  .appId(constants.STSA_SMART_APP_ID)
  .clientId(constants.STSA_SMART_APP_CLIENT_ID)
  .clientSecret(constants.STSA_SMART_APP_CLIENT_SECRET)
  .permissions(['r:devices:*', 'r:locations:*'])
  .page('mainPage', (_context, page) => {
    page.name('Installation').complete(true);
  })
  .installed(async (context, installData) => {
    logger.debug('SmartApp installed');
    await context.api.subscriptions.delete();
    await contextsCache.put(installData);
  })
  .subscribedDeviceEventHandler(DEVICE_EVENT_HANDLER_NAME, (_context, event) => {
    logger.debug('Device event received', event);
    eventsCaches.addEvent(event);
  });

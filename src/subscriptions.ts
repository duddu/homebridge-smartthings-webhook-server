import { ConfigValueType } from '@smartthings/core-sdk';
import { SmartAppContext } from '@smartthings/smartapp';

import { HSWSError } from './error';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME, smartApp } from './smartapp';
import { getAuthenticationTokens, getSubscribedDevicesIds, setSubscribedDevicesIds } from './store';

export const syncDevicesSubscriptions = async (
  webhookToken: string,
  clientDevicesIds: string[],
): Promise<void> => {
  const authTokens = await getAuthenticationTokens(webhookToken);

  const {
    api: {
      config: { installedAppId },
      subscriptions,
    },
  }: SmartAppContext = await smartApp.withContext({ installedAppId: webhookToken, ...authTokens });

  if (typeof installedAppId !== 'string') {
    throw new HSWSError('Unable to retrieve installed app id from smart app context');
  }

  if (typeof subscriptions === 'undefined') {
    throw new HSWSError(
      `The smart app context for the requested app id ${webhookToken} is not available. ` +
        'This app has likely been uninstalled from SmartThings.',
    );
  }

  const subscribedDevicesIds = await getSubscribedDevicesIds(installedAppId);

  if (
    clientDevicesIds
      .concat(subscribedDevicesIds)
      .filter((id) => !(clientDevicesIds.includes(id) && subscribedDevicesIds.includes(id)))
      .length === 0
  ) {
    return;
  }

  logger.debug('Syncing devices subscriptions with client bridge configuration', {
    installedAppId,
    clientDevicesCount: clientDevicesIds.length,
    subscribedDevicesCount: subscribedDevicesIds.length,
  });

  try {
    await subscriptions.delete();
    await subscriptions.subscribeToDevices(
      subscribedDevicesIds.map((deviceId) => ({
        valueType: ConfigValueType.DEVICE,
        deviceConfig: {
          deviceId,
          componentId: 'main',
          permissions: ['r'],
        },
      })),
      '*',
      '*',
      DEVICE_EVENT_HANDLER_NAME,
    );
    await setSubscribedDevicesIds(installedAppId, subscribedDevicesIds);
  } catch (e) {
    try {
      await setSubscribedDevicesIds(installedAppId, []);
      await subscriptions.delete();
    } catch (_e) {
      logger.warn('Unable to execute devices subscription failure fallback', { installedAppId });
    }

    throw new HSWSError(
      `Unable to subscribe installed app ${installedAppId} to registered devices events`,
      e,
    );
  }

  logger.debug('Subscribed to registered devices events', { installedAppId });
};

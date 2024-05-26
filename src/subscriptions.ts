import {
  ConfigEntry,
  ConfigValueType,
  DeviceSubscriptionDetail,
  Subscription,
  SubscriptionSource,
  SubscriptionsEndpoint,
} from '@smartthings/core-sdk';

import { HSWSError } from './error';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME, smartApp } from './smartapp';
import {
  getAuthenticationTokens,
  getSubscribedDevicesIds,
  addSubscribedDevicesIds,
  removeSubscribedDevicesIds,
} from './store';

type HSWSSubscriptionsContext = {
  installedAppId: string;
  subscribedDevicesIds: string[];
  subscriptionsEndpoint: SubscriptionsEndpoint;
};

interface HSWSDeviceSubscription extends Subscription {
  id: string;
  device: DeviceSubscriptionDetail;
  sourceType: SubscriptionSource.DEVICE;
}

export const ensureSubscriptions = async (
  webhookToken: string,
  registeredDevicesIdsList: string[],
): Promise<void> => {
  const { authToken, refreshToken } = await getAuthenticationTokens(webhookToken);

  const smartAppContext = await smartApp.withContext({
    installedAppId: webhookToken,
    authToken,
    refreshToken,
  });

  const subscriptionsContext: HSWSSubscriptionsContext = {
    installedAppId: webhookToken,
    subscriptionsEndpoint: smartAppContext.api.subscriptions,
    subscribedDevicesIds: await getSubscribedDevicesIds(webhookToken),
  };

  if (typeof subscriptionsContext.subscriptionsEndpoint === 'undefined') {
    throw new HSWSError(
      `The smart app context for the requested app id ${webhookToken} is not available. ` +
        'This app has likely been uninstalled from SmartThings.',
    );
  }

  for (const task of [subscribeToRegisteredDevices, unsubscribeFromRemovedDevices]) {
    await task(registeredDevicesIdsList, subscriptionsContext);
  }
};

const subscribeToRegisteredDevices = async (
  registeredDevicesIds: string[],
  { installedAppId, subscriptionsEndpoint, subscribedDevicesIds }: HSWSSubscriptionsContext,
): Promise<void> => {
  const unsubscribedDevicesIds = registeredDevicesIds.filter(
    (id) => !subscribedDevicesIds.includes(id),
  );
  if (unsubscribedDevicesIds.length === 0) {
    return;
  }
  logger.debug('Received new registered devices to subscribe to', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.length,
    subscribedDevicesCount: subscribedDevicesIds.length,
    unsubscribedDevicesCount: unsubscribedDevicesIds.length,
  });
  try {
    await subscriptionsEndpoint.subscribeToDevices(
      getDevicesConfigEntries(unsubscribedDevicesIds),
      '*',
      '*',
      DEVICE_EVENT_HANDLER_NAME,
    );
    await addSubscribedDevicesIds(installedAppId, unsubscribedDevicesIds);
  } catch (e) {
    throw new HSWSError(
      `Unable to subscribe installed app ${installedAppId} to registered devices events`,
      e,
    );
  }
  logger.debug('Subscribed to new registered devices events', { installedAppId });
};

const unsubscribeFromRemovedDevices = async (
  registeredDevicesIds: string[],
  { installedAppId, subscriptionsEndpoint, subscribedDevicesIds }: HSWSSubscriptionsContext,
): Promise<void> => {
  const removedDevicesIds = subscribedDevicesIds.filter((id) => !registeredDevicesIds.includes(id));
  if (removedDevicesIds.length === 0) {
    return;
  }
  logger.debug('Received new devices to unsubscribe from', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.length,
    subscribedDevicesCount: subscribedDevicesIds.length,
    removedDevicesCount: removedDevicesIds.length,
  });
  try {
    await Promise.all(
      (await subscriptionsEndpoint.list())
        .filter(
          (subscription): subscription is HSWSDeviceSubscription =>
            typeof subscription.id === 'string' &&
            typeof subscription.device?.deviceId === 'string',
        )
        .filter(({ device }) => removedDevicesIds.includes(device.deviceId))
        .map(async ({ id, device }) => {
          await subscriptionsEndpoint.delete(id);
          await removeSubscribedDevicesIds(installedAppId, device.deviceId);
        }),
    );
  } catch (e) {
    throw new HSWSError(
      `Unable to unsubscribe installed app ${installedAppId} from unregistered devices events`,
      e,
    );
  }
  logger.debug('Unsubscribed from unregistered devices events', { installedAppId });
};

const getDevicesConfigEntries = (unsubscribedDevicesIds: string[]): ConfigEntry[] =>
  unsubscribedDevicesIds.map((deviceId) => ({
    valueType: ConfigValueType.DEVICE,
    deviceConfig: {
      deviceId,
      componentId: 'main',
      permissions: ['r'],
    },
  }));

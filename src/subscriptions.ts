import {
  ConfigEntry,
  ConfigValueType,
  DeviceSubscriptionDetail,
  Subscription,
  SubscriptionSource,
  SubscriptionsEndpoint,
} from '@smartthings/core-sdk';

import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME, smartApp } from './smartapp';
import { getAuthenticationTokens } from './store';

type HSWSSubscriptionsContext = {
  installedAppId: string;
  subscribedDevicesIds: Set<string>;
  subscriptionsEndpoint: SubscriptionsEndpoint;
};

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

  const subscriptionsContext = {
    installedAppId: webhookToken,
    subscribedDevicesIds: new Set<string>(),
    subscriptionsEndpoint: smartAppContext.api.subscriptions,
  };

  for (const task of [subscribeToRegisteredDevices, unsubscribeFromRemovedDevices]) {
    await task(new Set(registeredDevicesIdsList), subscriptionsContext);
  }
};

const subscribeToRegisteredDevices = async (
  registeredDevicesIds: Set<string>,
  { installedAppId, subscriptionsEndpoint, subscribedDevicesIds }: HSWSSubscriptionsContext,
): Promise<void> => {
  const unsubscribedDevicesIds = registeredDevicesIds;
  if (subscribedDevicesIds.size > 0) {
    for (const id of unsubscribedDevicesIds) {
      if (subscribedDevicesIds.has(id)) {
        unsubscribedDevicesIds.delete(id);
      }
    }
  }
  if (unsubscribedDevicesIds.size === 0) {
    return;
  }
  logger.debug('subscribeToRegisteredDevices(): Received new registered devices to subscribe to', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.size,
    subscribedDevicesCount: subscribedDevicesIds.size,
    unsubscribedDevicesCount: unsubscribedDevicesIds.size,
  });
  try {
    await subscriptionsEndpoint.subscribeToDevices(
      getDevicesConfigEntries(unsubscribedDevicesIds),
      '*',
      '*',
      DEVICE_EVENT_HANDLER_NAME,
    );
  } catch (e) {
    logger.error(
      'subscribeToRegisteredDevices(): Unable to subscribe installed app ' +
        `${installedAppId} to registered devices events`,
    );
    throw e;
  }
  for (const id of unsubscribedDevicesIds) {
    subscribedDevicesIds.add(id);
  }
  logger.debug('subscribeToRegisteredDevices(): Subscribed to new registered devices events', {
    installedAppId,
    subscribedDevicesCount: subscribedDevicesIds.size,
  });
};

interface HSWSDeviceSubscription extends Subscription {
  id: string;
  device: DeviceSubscriptionDetail;
  sourceType: SubscriptionSource.DEVICE;
}

const unsubscribeFromRemovedDevices = async (
  registeredDevicesIds: Set<string>,
  { installedAppId, subscriptionsEndpoint, subscribedDevicesIds }: HSWSSubscriptionsContext,
): Promise<void> => {
  const removedDevicesIds = new Set<string>();
  for (const id of subscribedDevicesIds) {
    if (!registeredDevicesIds.has(id)) {
      removedDevicesIds.add(id);
    }
  }
  if (removedDevicesIds.size === 0) {
    return;
  }
  logger.debug('unsubscribeFromRemovedDevices(): Received new devices to unsubscribe from', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.size,
    subscribedDevicesCount: subscribedDevicesIds.size,
    removedDevicesCount: removedDevicesIds.size,
  });
  try {
    await Promise.all(
      (await subscriptionsEndpoint.list())
        .filter(
          (subscription): subscription is HSWSDeviceSubscription =>
            typeof subscription.id === 'string' &&
            typeof subscription.device?.deviceId === 'string',
        )
        .filter(({ device }) => removedDevicesIds.has(device.deviceId))
        .map(async ({ id, device }) => {
          await subscriptionsEndpoint.delete(id);
          subscribedDevicesIds.delete(device.deviceId);
        }),
    );
  } catch (e) {
    logger.error(
      'unsubscribeFromRemovedDevices(): Unable to unsubscribe installed app ' +
        `${installedAppId} from unregistered devices events`,
    );
    throw e;
  }
  logger.debug('unsubscribeFromRemovedDevices(): Unsubscribed from unregistered devices events', {
    installedAppId,
    subscribedDevicesCount: subscribedDevicesIds.size,
  });
};

const getDevicesConfigEntries = (unsubscribedDevicesIds: Set<string>): ConfigEntry[] => {
  const configEntries: ConfigEntry[] = [];
  for (const deviceId of unsubscribedDevicesIds) {
    configEntries.push({
      valueType: ConfigValueType.DEVICE,
      deviceConfig: {
        deviceId,
        componentId: 'main',
        permissions: ['r'],
      },
    });
  }
  return configEntries;
};

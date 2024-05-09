import {
  ConfigEntry,
  ConfigValueType,
  DeviceSubscriptionDetail,
  Subscription,
  SubscriptionSource,
} from '@smartthings/core-sdk';
import { SmartAppContext } from '@smartthings/smartapp';

import { contextsCache, HSWSSmartAppContextsCacheItem } from './contexts';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME } from './smartapp';

export const subscribeInstalledApps = async (
  registeredDevicesIds: Set<string>,
): Promise<void[][]> =>
  Promise.all(
    contextsCache
      .getAllContexts()
      .map((contextCacheItem) => subscribeInstalledApp(contextCacheItem, registeredDevicesIds)),
  );

const subscribeInstalledApp = async (
  { context, subscribedDevicesIds }: HSWSSmartAppContextsCacheItem,
  registeredDevicesIds: Set<string>,
): Promise<void[]> =>
  Promise.all(
    [subscribeToRegisteredDevices, unsubscribeFromRemovedDevices].map((fn) =>
      fn.call(null, context, subscribedDevicesIds, registeredDevicesIds),
    ),
  );

const subscribeToRegisteredDevices = async (
  context: SmartAppContext,
  subscribedDevicesIds: Set<string>,
  registeredDevicesIds: Set<string>,
) => {
  const { installedAppId } = context.api.apps;
  const { subscriptions } = context.api;
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
  logger.debug('Received new registered devices to subscribe to', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.size,
    subscribedDevicesCount: subscribedDevicesIds.size,
    unsubscribedDevicesCount: unsubscribedDevicesIds.size,
  });
  try {
    await subscriptions.subscribeToDevices(
      getDevicesConfigEntries(unsubscribedDevicesIds),
      '*',
      '*',
      DEVICE_EVENT_HANDLER_NAME,
    );
  } catch (error) {
    logger.error(
      `Unable to subscribe installed app ${installedAppId} to registered devices events`,
      error,
    );
    return;
  }
  for (const id of unsubscribedDevicesIds) {
    subscribedDevicesIds.add(id);
  }
  logger.debug('Subscribed to new registered devices events', {
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
  context: SmartAppContext,
  subscribedDevicesIds: Set<string>,
  registeredDevicesIds: Set<string>,
) => {
  const { installedAppId } = context.api.apps;
  const { subscriptions } = context.api;
  const removedDevicesIds = new Set<string>();
  for (const id of subscribedDevicesIds) {
    if (!registeredDevicesIds.has(id)) {
      removedDevicesIds.add(id);
    }
  }
  if (removedDevicesIds.size === 0) {
    return;
  }
  logger.debug('Received new devices to unsubscribe from', {
    installedAppId,
    clientDevicesCount: registeredDevicesIds.size,
    subscribedDevicesCount: subscribedDevicesIds.size,
    removedDevicesCount: removedDevicesIds.size,
  });
  try {
    await Promise.all(
      (await subscriptions.list())
        .filter(
          (subscription): subscription is HSWSDeviceSubscription =>
            typeof subscription.id === 'string' &&
            typeof subscription.device?.deviceId === 'string',
        )
        .filter(({ device }) => removedDevicesIds.has(device.deviceId))
        .map(async ({ id, device }) => {
          await subscriptions.delete(id);
          subscribedDevicesIds.delete(device.deviceId);
        }),
    );
  } catch (error) {
    logger.error(
      `Unable to unsubscribe installed app ${installedAppId} from removed devices events`,
      error,
    );
    return;
  }
  logger.debug('Unsubscribed from removed devices events', {
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

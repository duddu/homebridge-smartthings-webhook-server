import { ConfigEntry, ConfigValueType } from '@smartthings/core-sdk';

import { contextsCache, HSWSSmartAppContextsCacheItem } from './context';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME } from './smartapp';

class HSWSDevices {
  public async subscribeAllInstalledApps(devicesIds: Set<string>): Promise<void[]> {
    return await Promise.all(
      contextsCache
        .getAllContexts()
        .map(async (context) => this.subscribeInstalledApp(context, devicesIds)),
    );
  }

  private async subscribeInstalledApp(
    { context, subscribedDevicesIds }: HSWSSmartAppContextsCacheItem,
    devicesIds: Set<string>,
  ): Promise<void> {
    const { installedAppId } = context.api.apps;
    try {
      const unsubscribedDevicesIds = devicesIds;
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
      logger.debug('Received new devices to subscribe to', {
        installedAppId,
        unsubscribedDevicesIds,
      });
      await context.api.subscriptions.subscribeToDevices(
        this.getDevicesConfigEntries(unsubscribedDevicesIds),
        '*',
        '*',
        DEVICE_EVENT_HANDLER_NAME,
      );
      for (const id of unsubscribedDevicesIds) {
        subscribedDevicesIds.add(id);
      }
      logger.debug('Subscribed to new devices events', {
        installedAppId,
        subscribedDevicesIds,
      });
    } catch (error) {
      logger.error(
        `Unable to subscribe installed app ${installedAppId} to new devices events`,
        error,
      );
      return Promise.resolve();
    }
  }

  private getDevicesConfigEntries = (unsubscribedDevicesIds: Set<string>): ConfigEntry[] => {
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
}

export const devices = new HSWSDevices();

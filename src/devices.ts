import { ConfigEntry, ConfigValueType, Subscription } from '@smartthings/core-sdk';
import { SmartAppContext } from '@smartthings/smartapp';

import { contextStore } from './context';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME } from './smartapp';

class HSWSDevices {
  private readonly subscribedDevicesIds: Set<string> = new Set();

  public async subscribeInstalledApp(
    context: SmartAppContext,
    configEntries?: ConfigEntry[],
  ): Promise<Subscription[]> {
    if (!configEntries) {
      const ids = [];
      for (const id of this.subscribedDevicesIds.values()) {
        ids.push(id);
      }
      configEntries = this.getDevicesConfigEntries(ids);
    }
    try {
      return await context.api.subscriptions.subscribeToDevices(
        configEntries,
        '*',
        '*',
        DEVICE_EVENT_HANDLER_NAME,
      );
    } catch (error) {
      logger.error(
        'Unable to subscribe to new devices events',
        {
          installedAppId: context.api.apps.installedAppId,
        },
        error,
      );
      return Promise.resolve([]);
    }
  }

  public async subscribeAllInstalledApps(devicesIds: string[]): Promise<string[]> {
    const newIds = devicesIds.filter((id) => !this.subscribedDevicesIds.has(id));
    if (newIds.length === 0) {
      return [];
    }
    const configEntries = this.getDevicesConfigEntries(newIds);
    await Promise.all(
      (await contextStore.getAllSmartAppContexts()).map(async (context) =>
        this.subscribeInstalledApp(context, configEntries),
      ),
    );
    for (const id of newIds) {
      this.subscribedDevicesIds.add(id);
    }
    return newIds;
  }

  private getDevicesConfigEntries = (devicesIds: string[]): ConfigEntry[] => {
    return devicesIds.map((deviceId) => ({
      valueType: ConfigValueType.DEVICE,
      deviceConfig: {
        deviceId,
        componentId: 'main',
        permissions: ['r'],
      },
    }));
  };
}

export const devices = new HSWSDevices();

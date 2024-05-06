import { ConfigEntry, ConfigValueType } from '@smartthings/core-sdk';

import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME, smartApp } from './smartapp';

class HSWSDevices {
  private readonly subscribedDevicesIds: Set<string> = new Set();

  public async subscribeToIds(devicesIds: string[]): Promise<string[]> {
    const newIds = devicesIds.filter((id) => !this.subscribedDevicesIds.has(id));
    if (newIds.length === 0) {
      return [];
    }
    logger.debug('Subscribing the smart app to new devices events', {
      ids: newIds,
      appId: process.env.SMART_APP_ID,
    });
    try {
      const smartAppContext = await smartApp.withContext(process.env.SMART_APP_ID!);
      await smartAppContext.api.subscriptions.subscribeToDevices(
        this.getDevicesConfigEntries(newIds),
        '*',
        '*',
        DEVICE_EVENT_HANDLER_NAME,
      );
      newIds.forEach((id) => {
        this.subscribedDevicesIds.add(id);
      });
      return newIds;
    } catch (error) {
      logger.error('Unable to subscribe the smart app to new devices events', {
        appId: process.env.SMART_APP_ID,
        error,
      });
      return [];
    }
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

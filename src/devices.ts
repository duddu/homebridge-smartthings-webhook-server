import {
  ConfigEntry,
  ConfigValueType,
  Subscription,
  SubscriptionsEndpoint,
} from '@smartthings/core-sdk';
import { SmartAppContext } from '@smartthings/smartapp';

import { contextStore } from './context';
import { logger } from './logger';
import { DEVICE_EVENT_HANDLER_NAME } from './smartapp';

class HSWSDevices {
  public async subscribeAllInstalledApps(devicesIds: string[]): Promise<Subscription[][]> {
    return await Promise.all(
      (await contextStore.getAllSmartAppContexts()).map(async (context) =>
        this.subscribeInstalledApp(context, devicesIds),
      ),
    );
  }

  private async subscribeInstalledApp(
    context: SmartAppContext,
    devicesIds: string[],
  ): Promise<Subscription[]> {
    const { installedAppId } = context.api.apps;
    const { subscriptions: subscriptionsEndpoint } = context.api;
    try {
      const unsubscribedDevicesIds = await this.getUnsubscribedDevicesIds(
        subscriptionsEndpoint,
        devicesIds,
      );
      logger.debug('Received new devices ids to subscribe to', {
        unsubscribedDevicesIds,
        installedAppId,
      });
      return await subscriptionsEndpoint.subscribeToDevices(
        this.getDevicesConfigEntries(unsubscribedDevicesIds),
        '*',
        '*',
        DEVICE_EVENT_HANDLER_NAME,
      );
    } catch (error) {
      logger.debug('Unable to subscribe to new devices events', { installedAppId, error });
      logger.error('Unable to subscribe to new devices events', { installedAppId, error });
      return Promise.resolve([]);
    }
  }

  private getUnsubscribedDevicesIds = async (
    subscriptionsEndpoint: SubscriptionsEndpoint,
    devicesIds: string[],
  ) => {
    const subscriptions = await subscriptionsEndpoint.list();
    const subscribedDevicesIds = subscriptions.map(({ device }) => device?.deviceId);
    return devicesIds.filter((id) => !subscribedDevicesIds.includes(id));
  };

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

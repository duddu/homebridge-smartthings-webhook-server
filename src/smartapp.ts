import { ConfigValueType } from '@smartthings/core-sdk';
import { SmartApp } from '@smartthings/smartapp';

import { DEVICE_EVENTS_QUEUE } from './events';

export const smartapp = new SmartApp()
  .enableEventLogging(2)
  .appId('9c74d2c3-1ed8-4a90-95bc-389fe9c22011')
  .permissions(['r:devices:*', 'r:locations:*'])
  .page('mainPage', () => {})
  .installed(async (context) => {
    // eslint-disable-next-line no-console
    console.info('-----installed');
    await context.api.subscriptions.delete(); // clear any existing configuration
    await context.api.subscriptions.subscribeToDevices(
      [
        {
          valueType: ConfigValueType.DEVICE,
          deviceConfig: {
            deviceId: '918f7f2c-b923-4d0c-8348-2828c7410849',
            componentId: 'main',
            permissions: ['r'],
          },
        },
      ],
      '*',
      '*',
      'HSWSdeviceEventHandler',
    );
  })
  .subscribedDeviceEventHandler('HSWSdeviceEventHandler', async (_context, event) => {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(event, undefined, 2));
    DEVICE_EVENTS_QUEUE.push(event);
    // const value = event.value === 'open' ? 'on' : 'off';
    // await context.api.devices.sendCommands(context.config.lights, 'switch', value);
  });

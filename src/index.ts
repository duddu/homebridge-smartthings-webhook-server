import { ConfigValueType } from '@smartthings/core-sdk';
import { SmartApp } from '@smartthings/smartapp';
import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import express from 'express';

const server = express();
const PORT = 10000;

const DEVICE_EVENTS_QUEUE: AppEvent.DeviceEvent[] = [];

export const smartapp = new SmartApp()
  .enableEventLogging(2)
  // .page('mainPage', (_context, page) => {
  //   page.section('sensors', (section) => {
  //     section.deviceSetting('contactSensor').capabilities(['contactSensor']);
  //   });
  //   page.section('lights', (section) => {
  //     section.deviceSetting('lights').capabilities(['*']).permissions('r').multiple(true);
  //   });
  // })
  .updated(async (context) => {
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
  .subscribedEventHandler('HSWSdeviceEventHandler', async (_context, event) => {
    DEVICE_EVENTS_QUEUE.push(event);
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(event, undefined, 2));
    // const value = event.value === 'open' ? 'on' : 'off';
    // await context.api.devices.sendCommands(context.config.lights, 'switch', value);
  });

server.use(express.json());

server.get('/healthz', (_req, res) => {
  // eslint-disable-next-line no-console
  console.log('/healthz 200');
  res.sendStatus(200);
});

/* Handle POST requests */
server.post('/webhook', (req, res) => {
  smartapp.handleHttpCallback(req, res);
});

/* Start listening at your defined PORT */
// eslint-disable-next-line no-console
server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));

import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { store } from './store';

export const storeDeviceEvent = async (
  webhookToken: string,
  event: AppEvent.DeviceEvent,
): Promise<void> => store.addDeviceEvent(webhookToken, event.eventId, shortenDeviceEvent(event));

const shortenDeviceEvent = ({
  deviceId,
  value,
  componentId,
  capability,
  attribute,
}: AppEvent.DeviceEvent): ShortEvent => ({
  deviceId,
  value,
  componentId,
  capability,
  attribute,
});

import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { store } from './store';

export const flushDevicesEvents = (webhookToken: string): ShortEvent[] => {
  const events = store.getEvents(webhookToken);
  const eventsList = Array.from(events);
  events.clear();
  return eventsList;
};

export const storeDeviceEvent = (webhookToken: string, event: AppEvent.DeviceEvent): void =>
  store.addEvent(webhookToken, shortenDeviceEvent(event));

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

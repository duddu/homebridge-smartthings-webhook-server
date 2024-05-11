import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { ShortEvent } from 'homebridge-smartthings-ik/dist/webhook/subscriptionHandler';
import { HSWSEventsQueue, store } from './store';
import { logger } from './logger';

export const flushDevicesEvents = (webhookToken: string): ShortEvent[] => {
  let events: HSWSEventsQueue;
  try {
    events = store.getEvents(webhookToken);
  } catch (e) {
    logger.warn(
      'flushDevicesEvents(): Unable to get devices events; make sure you ' +
        'COPY THE WEBHOOK TOKEN value from the SmartThings app installation screen to ' +
        'the configuration of the Homebridge SmartThings plugin before calling the server.',
      { error: e instanceof Error ? e.message : e },
    );
    return [];
  }
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

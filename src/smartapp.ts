import { InstalledAppConfiguration } from '@smartthings/core-sdk';
import { Page, SmartApp, SmartAppContext } from '@smartthings/smartapp';
import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { v4 as uuidv4 } from 'uuid';

import { constants } from './constants';
import { storeDeviceEvent } from './events';
import { logger, smartAppLogger } from './logger';
import { store } from './store';

export const DEVICE_EVENT_HANDLER_NAME = 'HSWSDeviceEventHandler';

const WEBHOOK_TOKEN_CONFIG_NAME = 'WebhookToken';

const WEBHOOK_TOKEN_CONFIG_DESCRIPTION =
  'Copy this value in the Webhook Token field of the Homebridge SmartThings plugin configuration.';

const WEBHOOK_TOKEN_CONFIG_INFO_HEADER = 'How is the Webhook Token used?';

const WEBHOOK_TOKEN_CONFIG_INFO_TEXT =
  'This unique identifier is auto-generated and remains associated with this specific ' +
  'installed app, until uninstalled. This means you could have multiple child bridges of the ' +
  'SmartThings plugin configured on your Homebridge (or multiple Homebridge instances), and ' +
  'as long as each configuration links to a single installed app via this identifier, each one ' +
  'of them can have a separate dedicated channel of communication with the same webhook server.';

const SMART_APP_PERMISSIONS = ['r:devices:*', 'r:locations:*'];

const EVENT_LOGGING_ENABLED = logger.level === 'silly';

const installedCallback = async (
  { api }: SmartAppContext,
  { installedApp }: AppEvent.InstallData,
): Promise<void> => {
  logger.debug('SmartApp installed');
  await api.subscriptions.delete();
  store.initCache(
    getWebhookTokenFromConfig(installedApp.config),
    installedApp.installedAppId,
    api.subscriptions,
  );
};

const uninstalledCallback = async (
  { api }: SmartAppContext,
  { installedApp }: AppEvent.UninstallData,
): Promise<void> => {
  logger.debug('SmartApp uninstalled');
  await api.subscriptions.delete();
  store.clearCache(getWebhookTokenFromConfig(installedApp.config));
};

const deviceEventCallback = ({ config }: SmartAppContext, event: AppEvent.DeviceEvent): void => {
  logger.debug('Device event received', event);
  storeDeviceEvent(getWebhookTokenFromConfig(config), event);
};

const defaultPageCallback = (
  _context: SmartAppContext,
  page: Page,
  configData?: InstalledAppConfiguration,
): void => {
  page.name('Installation');
  page.section('Config', (section) => {
    section
      .textSetting(WEBHOOK_TOKEN_CONFIG_NAME)
      .name(WEBHOOK_TOKEN_CONFIG_NAME)
      .description(WEBHOOK_TOKEN_CONFIG_DESCRIPTION)
      .defaultValue(getWebhookTokenDefault(configData))
      .disabled(true);
  });
  page.section('Info', (section) => {
    section
      .hideable(true)
      .hidden(false)
      .paragraphSetting('WebhookTokenInfo')
      .name(WEBHOOK_TOKEN_CONFIG_INFO_HEADER)
      .description(WEBHOOK_TOKEN_CONFIG_INFO_TEXT);
  });
};

const getWebhookTokenDefault = (configData?: InstalledAppConfiguration): string =>
  configData?.config[WEBHOOK_TOKEN_CONFIG_NAME]?.stringConfig?.value || uuidv4();

const getWebhookTokenFromConfig = (config: AppEvent.ConfigMap): string => {
  try {
    const webhookToken = config[WEBHOOK_TOKEN_CONFIG_NAME][0]?.stringConfig?.value as string;
    if (typeof webhookToken !== 'string' || webhookToken === '') {
      throw new Error('WebhookToken value is not a valid string');
    }
    return webhookToken;
  } catch (error) {
    logger.error('smartApp: Unable to retrieve webhookToken from app config', { config, error });
    throw error;
  }
};

export const smartApp = new SmartApp()
  .configureLogger(smartAppLogger)
  .enableEventLogging(2, EVENT_LOGGING_ENABLED)
  .appId(constants.STSA_SMART_APP_ID)
  .clientId(constants.STSA_SMART_APP_CLIENT_ID)
  .clientSecret(constants.STSA_SMART_APP_CLIENT_SECRET)
  .permissions(SMART_APP_PERMISSIONS)
  .defaultPage(defaultPageCallback)
  .installed(installedCallback)
  .uninstalled(uninstalledCallback)
  .subscribedDeviceEventHandler(DEVICE_EVENT_HANDLER_NAME, deviceEventCallback);

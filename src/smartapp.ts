import { InstalledAppConfiguration } from '@smartthings/core-sdk';
import { Page, SmartApp, SmartAppContext } from '@smartthings/smartapp';
import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { Initialization } from '@smartthings/smartapp/lib/util/initialization';
import { v4 as uuidv4 } from 'uuid';

import { constants } from './constants';
import { storeDeviceEvent } from './events';
import { logger, smartAppLogger } from './logger';
import { store } from './store';

export const DEVICE_EVENT_HANDLER_NAME = 'HSWSDeviceEventHandler';
const WEBHOOK_TOKEN_CONFIG_NAME = 'WebhookToken';
const WEBHOOK_TOKEN_CONFIG_DESCRIPTION =
  'Copy this value in the Webhook Token field of your Homebridge SmartThings plugin configuration:';
const WEBHOOK_TOKEN_CONFIG_INFO_TITLE = 'MORE INFO';
const WEBHOOK_TOKEN_CONFIG_INFO_HEADER = 'How is the Webhook Token used?';
const WEBHOOK_TOKEN_CONFIG_INFO_TEXT =
  'This unique id is auto-generated (no need to edit it) and coupled solely with this specific ' +
  'installed smart app, until it gets uninstalled.\n' +
  'This means you could have multiple child bridges of the SmartThings plugin configured on ' +
  'your Homebridge (or on multiple Homebridge instances), and as long as each bridge ' +
  'configuration links to a single installed smart app via this identifier, each one of them ' +
  'can have a separate dedicated channel of communication with the same webhook server.';
const DEFAULT_PAGE_TITLE = 'SmartApp Installation';
const SMART_APP_PERMISSIONS = ['r:devices:*', 'r:locations:*'];
const EVENT_LOGGING_ENABLED = logger.level === 'silly';

const appInitializedCallback = (
  context: SmartAppContext,
  _initialization: Initialization,
  configData: AppEvent.ConfigurationData,
): void => {
  logger.debug('SmartApp initialized');
  logger.debug('appInitializedCallback()', {
    'context.api.installedApps.installedAppId': context.api.installedApps?.installedAppId,
    'context.api.apps.installedAppId': context.api.apps?.installedAppId,
    'context.api.config.installedAppId': context.api.config?.installedAppId,
    'configData.installedAppId': configData?.installedAppId,
    'configData.phase': configData?.phase,
    configData,
  });
  if (configData && typeof configData?.installedAppId !== 'string') {
    configData.installedAppId = 'gne';
  }
};

const appInstalledCallback = async (
  { api }: SmartAppContext,
  installData: AppEvent.InstallData,
): Promise<void> => {
  logger.debug('SmartApp installed');
  logger.debug('appInstalledCallback()', {
    'context.api.installedApps.installedAppId': api.installedApps?.installedAppId,
    'context.api.apps.installedAppId': api.apps?.installedAppId,
    'context.api.config.installedAppId': api.config?.installedAppId,
    'installedApp.installedAppId': installData.installedApp?.installedAppId,
    'installedApp.config': installData.installedApp?.config,
  });
  await api.subscriptions.delete();
  store.initCache(
    getWebhookTokenFromConfig(installData.installedApp.config),
    installData.installedApp.installedAppId,
    api.subscriptions,
  );
};

const appUninstalledCallback = async (
  _context: SmartAppContext,
  { installedApp }: AppEvent.UninstallData,
): Promise<void> => {
  logger.debug('SmartApp uninstalled');
  store.clearCache(getWebhookTokenFromConfig(installedApp.config));
};

// const appUpdatedCallback = async (
//   _context: SmartAppContext,
//   { previousConfig, installedApp }: AppEvent.UpdateData,
// ): Promise<void> => {
//   logger.debug('SmartApp updated');
//   // if
//   store.clearCache(getWebhookTokenFromConfig(installedApp.config));
// };

const deviceEventCallback = ({ config }: SmartAppContext, event: AppEvent.DeviceEvent): void => {
  logger.debug('Device event received', event);
  storeDeviceEvent(getWebhookTokenFromConfig(config), event);
};

const defaultPageCallback = (
  context: SmartAppContext,
  page: Page,
  configData?: InstalledAppConfiguration,
): void => {
  logger.debug('defaultPageCallback()', {
    'context.api.installedApps.installedAppId': context.api?.installedApps?.installedAppId,
    'context.api.apps.installedAppId': context.api?.apps?.installedAppId,
    'context.api.config.installedAppId': context.api?.config?.installedAppId,
    'configData.installedAppId': configData?.installedAppId,
    'configData.configurationStatus': configData?.configurationStatus,
  });
  page.name(DEFAULT_PAGE_TITLE);
  page.section(WEBHOOK_TOKEN_CONFIG_DESCRIPTION, (section) => {
    section
      .textSetting(WEBHOOK_TOKEN_CONFIG_NAME)
      .name(WEBHOOK_TOKEN_CONFIG_NAME)
      .defaultValue(getWebhookTokenDefault(configData))
      .required(true);
  });
  page.section(WEBHOOK_TOKEN_CONFIG_INFO_TITLE, (section) => {
    section
      .hideable(true)
      .hidden(false)
      .paragraphSetting(WEBHOOK_TOKEN_CONFIG_INFO_HEADER)
      .name(WEBHOOK_TOKEN_CONFIG_INFO_HEADER)
      .description(WEBHOOK_TOKEN_CONFIG_INFO_TEXT);
  });
};

const getWebhookTokenDefault = (configData?: InstalledAppConfiguration): string =>
  configData?.config[WEBHOOK_TOKEN_CONFIG_NAME]?.stringConfig?.value || uuidv4();

const getWebhookTokenFromConfig = (config: AppEvent.ConfigMap): string => {
  try {
    const webhookToken = config[WEBHOOK_TOKEN_CONFIG_NAME][0]?.stringConfig?.value as string;
    if (typeof webhookToken !== 'string' || webhookToken.trim() === '') {
      throw new Error('WebhookToken value is not a valid string');
    }
    return webhookToken.trim();
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
  .initialized(appInitializedCallback)
  .installed(appInstalledCallback)
  // .updated() @TODO if webhookToken changed clear old +init new
  .uninstalled(appUninstalledCallback)
  .subscribedDeviceEventHandler(DEVICE_EVENT_HANDLER_NAME, deviceEventCallback);

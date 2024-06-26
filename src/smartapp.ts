import { InstalledAppConfiguration } from '@smartthings/core-sdk';
import {
  ContextRecord,
  ContextStore,
  Page,
  SmartApp,
  SmartAppContext,
} from '@smartthings/smartapp';
import { AppEvent } from '@smartthings/smartapp/lib/lifecycle-events';
import { Initialization } from '@smartthings/smartapp/lib/util/initialization';

import { constants } from './constants';
import { HSWSError } from './error';
import { storeDeviceEvent } from './events';
import { logger, smartAppLogger } from './logger';
import { store } from './store';

export const DEVICE_EVENT_HANDLER_NAME = 'HSWSDeviceEventHandler';
const WEBHOOK_TOKEN_CONFIG_NAME = 'Webhook Token';
const WEBHOOK_TOKEN_CONFIG_DESCRIPTION =
  'Copy this value in the Webhook Token field of your Homebridge SmartThings plugin configuration:';
const WEBHOOK_TOKEN_CONFIG_INFO_TITLE = 'MORE INFO';
const WEBHOOK_TOKEN_CONFIG_INFO_HEADER = 'How is the Webhook Token used?';
const WEBHOOK_TOKEN_CONFIG_INFO_TEXT =
  'This value is the unique identifier of this specific SmartApp instance. By using it as ' +
  'Webhook Token as well we ensure they are coupled for the entire lifespan of this app.\n' +
  'This means you could have multiple child bridges of the SmartThings plugin configured on ' +
  'your Homebridge (or on multiple Homebridge instances), and as long as each bridge ' +
  'configuration links to a single installed smart app via this identifier, each one of them ' +
  'can have a separate dedicated channel of communication with the same webhook server.\n' +
  'Note: there is no point in editing the token input, as it will be overriden again with the ' +
  'smart app id automatically; the value is on this page just for you to select and copy.';
const DEFAULT_PAGE_TITLE = 'SmartApp Installation';
const SMART_APP_PERMISSIONS = ['r:devices:*', 'r:locations:*'];
const EVENT_LOGGING_ENABLED = logger.level === 'silly';

const appInitializedCallback = (
  _context: SmartAppContext,
  _initialization: Initialization,
  { installedAppId }: AppEvent.ConfigurationData,
): void => {
  logger.debug('SmartApp initialized', { installedAppId });
};

const defaultPageCallback = (
  _context: SmartAppContext,
  page: Page,
  configData?: InstalledAppConfiguration,
): void => {
  const installedAppId = configData?.installedAppId;

  if (typeof installedAppId !== 'string') {
    const message = 'Unable to retrieve installedAppId while loading user configuration page';
    logger.error(message, { configData });
    throw new HSWSError(message);
  }

  logger.debug('Presenting user configuration page', { installedAppId });

  page.name(DEFAULT_PAGE_TITLE);
  page.section(WEBHOOK_TOKEN_CONFIG_DESCRIPTION, (section) => {
    section
      .textSetting(`${WEBHOOK_TOKEN_CONFIG_NAME.replaceAll(' ', '')}_${Date.now()}`)
      .name(WEBHOOK_TOKEN_CONFIG_NAME)
      .defaultValue(installedAppId)
      .required(false);
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

const appInstalledCallback = async (
  { api }: SmartAppContext,
  { installedApp, authToken, refreshToken }: AppEvent.InstallData,
): Promise<void> => {
  const { installedAppId } = installedApp;

  logger.debug('SmartApp installed', { installedAppId });

  await api.subscriptions.delete();

  await store.initCache(installedAppId, authToken, refreshToken);
};

const appUninstalledCallback = async (
  _context: SmartAppContext,
  { installedApp }: AppEvent.UninstallData,
): Promise<void> => {
  const { installedAppId } = installedApp;

  logger.debug('SmartApp uninstalled', { installedAppId });

  await store.clearCache(installedAppId);
};

const deviceEventCallback = ({ api }: SmartAppContext, event: AppEvent.DeviceEvent): void => {
  const { installedAppId } = api.config;

  logger.debug('Device event received', { event, installedAppId });

  if (typeof installedAppId !== 'string') {
    logger.error('Unable to store the device event, installedAppId is not available');
    return;
  }

  storeDeviceEvent(installedAppId, event);
};

class HSWSContextStore implements ContextStore {
  public get = async (installedAppId: string): Promise<ContextRecord> => ({
    installedAppId,
    ...(await store.getAuthenticationTokens(installedAppId)),
  });

  public put = async (appContext: ContextRecord): Promise<ContextRecord> => {
    const { installedAppId, authToken, refreshToken } = appContext;
    await store.setAuthenticationTokens(installedAppId, { authToken, refreshToken });
    return appContext;
  };

  public update = async (
    installedAppId: string,
    updatedAppContext: Partial<ContextRecord>,
  ): Promise<Partial<ContextRecord>> => {
    const { authToken: updatedAuthToken, refreshToken: updatedRefreshToken } = updatedAppContext;
    if (typeof updatedAuthToken === 'string' || typeof updatedRefreshToken === 'string') {
      const { authToken: currentAuthToken, refreshToken: currentRefreshToken } =
        await store.getAuthenticationTokens(installedAppId);
      if (updatedAuthToken !== currentAuthToken || updatedRefreshToken !== currentRefreshToken) {
        await store.setAuthenticationTokens(installedAppId, {
          authToken: updatedAuthToken ?? currentAuthToken,
          refreshToken: updatedRefreshToken ?? currentRefreshToken,
        });
      }
    }
    return updatedAppContext;
  };

  public delete = async (installedAppId: string): Promise<void> => {
    await store.clearCache(installedAppId);
  };
}

export const smartApp = new SmartApp()
  .configureLogger(smartAppLogger)
  .enableEventLogging(2, EVENT_LOGGING_ENABLED)
  .appId(constants.STSA_SMART_APP_ID)
  .clientId(constants.STSA_SMART_APP_CLIENT_ID)
  .clientSecret(constants.STSA_SMART_APP_CLIENT_SECRET)
  .permissions(SMART_APP_PERMISSIONS)
  .contextStore(new HSWSContextStore())
  .defaultPage(defaultPageCallback)
  .initialized(appInitializedCallback)
  .installed(appInstalledCallback)
  .uninstalled(appUninstalledCallback)
  .subscribedDeviceEventHandler(DEVICE_EVENT_HANDLER_NAME, deviceEventCallback);

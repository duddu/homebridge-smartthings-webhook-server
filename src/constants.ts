import { HSWSError } from './error';

enum HSWSRequiredConstants {
  HSWS_PORT = 'HSWS_PORT',
  HSWS_VERSION = 'HSWS_VERSION',
  HSWS_REVISION = 'HSWS_REVISION',
  HSWS_LOG_LEVEL = 'HSWS_LOG_LEVEL',
  HSWS_REDIS_HOST = 'HSWS_REDIS_HOST',
  HSWS_REDIS_PORT = 'HSWS_REDIS_PORT',
  HSWS_REDIS_PASSWORD = 'HSWS_REDIS_PASSWORD',
  STSA_SMART_APP_ID = 'STSA_SMART_APP_ID',
  STSA_SMART_APP_CLIENT_ID = 'STSA_SMART_APP_CLIENT_ID',
  STSA_SMART_APP_CLIENT_SECRET = 'STSA_SMART_APP_CLIENT_SECRET',
}

enum HSWSOptionalConstants {
  HSWS_REDIS_TLS_ENABLED = 'HSWS_REDIS_TLS_ENABLED',
  HSWS_REDIS_DATABASE_NUMBER = 'HSWS_REDIS_DATABASE_NUMBER',
}

type HSWSRequiredConstantsKeys = keyof typeof HSWSRequiredConstants;
type HSWSOptionalConstantsKeys = keyof typeof HSWSOptionalConstants;

type HSWSRequiredConstantsRecord = Record<HSWSRequiredConstantsKeys, string>;
type HSWSOptionalConstantsRecord = Record<HSWSOptionalConstantsKeys, string | undefined>;
type HSWSConstantsRecords = HSWSRequiredConstantsRecord & HSWSOptionalConstantsRecord;

type HSWSConstantsExcludedKeys = Exclude<keyof HSWSConstants, keyof HSWSConstantsRecords>;
type HSWSConstantsType = Readonly<HSWSConstantsRecords & Record<HSWSConstantsExcludedKeys, never>>;

class HSWSConstants implements HSWSConstantsType {
  public readonly HSWS_PORT: string;
  public readonly HSWS_VERSION: string;
  public readonly HSWS_REVISION: string;
  public readonly HSWS_LOG_LEVEL: string;
  public readonly HSWS_REDIS_HOST: string;
  public readonly HSWS_REDIS_PORT: string;
  public readonly HSWS_REDIS_PASSWORD: string;
  public readonly HSWS_REDIS_TLS_ENABLED: string | undefined;
  public readonly HSWS_REDIS_DATABASE_NUMBER: string | undefined;
  public readonly STSA_SMART_APP_ID: string;
  public readonly STSA_SMART_APP_CLIENT_ID: string;
  public readonly STSA_SMART_APP_CLIENT_SECRET: string;

  constructor() {
    this.HSWS_PORT = this.required(HSWSRequiredConstants.HSWS_PORT);
    this.HSWS_VERSION = this.required(HSWSRequiredConstants.HSWS_VERSION);
    this.HSWS_REVISION = this.required(HSWSRequiredConstants.HSWS_REVISION);
    this.HSWS_LOG_LEVEL = this.required(HSWSRequiredConstants.HSWS_LOG_LEVEL);
    this.HSWS_REDIS_HOST = this.required(HSWSRequiredConstants.HSWS_REDIS_HOST);
    this.HSWS_REDIS_PORT = this.required(HSWSRequiredConstants.HSWS_REDIS_PORT);
    this.HSWS_REDIS_PASSWORD = this.required(HSWSRequiredConstants.HSWS_REDIS_PASSWORD);
    this.HSWS_REDIS_TLS_ENABLED = this.optional(HSWSOptionalConstants.HSWS_REDIS_TLS_ENABLED);
    this.HSWS_REDIS_DATABASE_NUMBER = this.optional(
      HSWSOptionalConstants.HSWS_REDIS_DATABASE_NUMBER,
    );
    this.STSA_SMART_APP_ID = this.required(HSWSRequiredConstants.STSA_SMART_APP_ID);
    this.STSA_SMART_APP_CLIENT_ID = this.required(HSWSRequiredConstants.STSA_SMART_APP_CLIENT_ID);
    this.STSA_SMART_APP_CLIENT_SECRET = this.required(
      HSWSRequiredConstants.STSA_SMART_APP_CLIENT_SECRET,
    );
  }

  private required(key: HSWSRequiredConstantsKeys): string {
    const { [key]: value } = process.env;
    if (this.isNotEmpty(value)) {
      return value.trim();
    }
    throw new HSWSError(`Required environment variable "${key}" not set or empty`);
  }

  private optional(key: HSWSOptionalConstantsKeys): string | undefined {
    const { [key]: value } = process.env;
    return this.isNotEmpty(value) ? value.trim() : undefined;
  }

  private isNotEmpty(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
  }
}

export const constants = Object.freeze(new HSWSConstants());

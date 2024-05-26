import { HSWSError } from './error';

export enum HSWSRequiredConstants {
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

export enum HSWSOptionalConstants {
  HSWS_REDIS_TLS_ENABLED = 'HSWS_REDIS_TLS_ENABLED',
  HSWS_REDIS_DATABASE_NUMBER = 'HSWS_REDIS_DATABASE_NUMBER',
}

type HSWSRequiredConstantsKeys = keyof typeof HSWSRequiredConstants;
type HSWSOptionalConstantsKeys = keyof typeof HSWSOptionalConstants;

type HSWSDefinedConstants = {
  [K in HSWSRequiredConstantsKeys]: string;
} & {
  [K in HSWSOptionalConstantsKeys]: string | undefined;
} & {
  [K in Exclude<keyof HSWSConstants, HSWSRequiredConstantsKeys | HSWSOptionalConstantsKeys>]: never;
};

class HSWSConstants implements HSWSDefinedConstants {
  public get HSWS_PORT(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_PORT);
  }

  public get HSWS_VERSION(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_VERSION);
  }

  public get HSWS_REVISION(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_REVISION);
  }

  public get HSWS_LOG_LEVEL(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_LOG_LEVEL);
  }

  public get HSWS_REDIS_HOST(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_REDIS_HOST);
  }

  public get HSWS_REDIS_PORT(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_REDIS_PORT);
  }

  public get HSWS_REDIS_PASSWORD(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.HSWS_REDIS_PASSWORD);
  }

  public get HSWS_REDIS_TLS_ENABLED(): string | undefined {
    return this.getOptionalConstant(HSWSOptionalConstants.HSWS_REDIS_TLS_ENABLED);
  }

  public get HSWS_REDIS_DATABASE_NUMBER(): string | undefined {
    return this.getOptionalConstant(HSWSOptionalConstants.HSWS_REDIS_DATABASE_NUMBER);
  }

  public get STSA_SMART_APP_ID(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.STSA_SMART_APP_ID);
  }

  public get STSA_SMART_APP_CLIENT_ID(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.STSA_SMART_APP_CLIENT_ID);
  }

  public get STSA_SMART_APP_CLIENT_SECRET(): string {
    return this.getRequiredConstant(HSWSRequiredConstants.STSA_SMART_APP_CLIENT_SECRET);
  }

  private getRequiredConstant(key: HSWSRequiredConstantsKeys): string {
    const { [key]: value } = process.env;
    if (this.isNotEmpty(value)) {
      return value.trim();
    }
    throw new HSWSError(`Required environment variable "${key}" not set or empty`);
  }

  private getOptionalConstant(key: HSWSOptionalConstantsKeys): string | undefined {
    const { [key]: value } = process.env;
    return this.isNotEmpty(value) ? value.trim() : undefined;
  }

  private isNotEmpty(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
  }
}

export const constants = Object.freeze(new HSWSConstants());

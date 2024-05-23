import { HSWSError } from './error';

enum HSWSRequiredConstants {
  HSWS_PORT,
  HSWS_VERSION,
  HSWS_REVISION,
  HSWS_LOG_LEVEL,
  HSWS_REDIS_HOST,
  HSWS_REDIS_PORT,
  HSWS_REDIS_PASSWORD,
  STSA_SMART_APP_ID,
  STSA_SMART_APP_CLIENT_ID,
  STSA_SMART_APP_CLIENT_SECRET,
}

enum HSWSOptionalConstants {
  HSWS_REDIS_TLS_ENABLED,
  HSWS_REDIS_DATABASE_NUMBER,
}

type HSWSRequiredConstantsKeys = keyof typeof HSWSRequiredConstants;
type HSWSOptionalConstantsKeys = keyof typeof HSWSOptionalConstants;

type HSWSRequiredConstantsRecord = Record<HSWSRequiredConstantsKeys, string>;
type HSWSOptionalConstantsRecord = Record<HSWSOptionalConstantsKeys, string | undefined>;
type HSWSConstantsRecords = HSWSRequiredConstantsRecord & HSWSOptionalConstantsRecord;

type HSWSConstantsExcludedKeys = Exclude<keyof HSWSConstants, keyof HSWSConstantsRecords>;
type HSWSConstantsType = Readonly<HSWSConstantsRecords & Record<HSWSConstantsExcludedKeys, never>>;

class HSWSConstants implements HSWSConstantsType {
  public declare readonly HSWS_PORT: string;
  public declare readonly HSWS_VERSION: string;
  public declare readonly HSWS_REVISION: string;
  public declare readonly HSWS_LOG_LEVEL: string;
  public declare readonly HSWS_REDIS_HOST: string;
  public declare readonly HSWS_REDIS_PORT: string;
  public declare readonly HSWS_REDIS_PASSWORD: string;
  public declare readonly HSWS_REDIS_TLS_ENABLED: string | undefined;
  public declare readonly HSWS_REDIS_DATABASE_NUMBER: string | undefined;
  public declare readonly STSA_SMART_APP_ID: string;
  public declare readonly STSA_SMART_APP_CLIENT_ID: string;
  public declare readonly STSA_SMART_APP_CLIENT_SECRET: string;

  constructor() {
    for (const [constants, validator] of this.validatorsMap) {
      Object.defineProperties(
        this,
        Object.values<string | number>(constants).reduce((properties, key) => {
          if (typeof key === 'string') {
            properties[key] = { get: () => validator(key) };
          }
          return properties;
        }, {} as PropertyDescriptorMap),
      );
    }
  }

  private getRequiredConstant(key: string): string {
    const { [key]: value } = process.env;
    if (typeof value !== 'string' || value.trim() === '') {
      throw new HSWSError(`Required environment variable "${key}" not set or empty`);
    }
    return value.trim();
  }

  private getOptionalConstant(key: string): string | undefined {
    try {
      return this.getRequiredConstant(key);
    } catch (e) {
      return void 0;
    }
  }

  private get validatorsMap(): (
    | [typeof HSWSRequiredConstants, typeof this.getRequiredConstant]
    | [typeof HSWSOptionalConstants, typeof this.getOptionalConstant]
  )[] {
    return [
      [HSWSRequiredConstants, this.getRequiredConstant.bind(this)],
      [HSWSOptionalConstants, this.getOptionalConstant.bind(this)],
    ];
  }
}

export const constants = Object.freeze(new HSWSConstants());

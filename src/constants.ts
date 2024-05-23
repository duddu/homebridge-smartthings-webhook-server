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
type HSWSConstantsRecord = HSWSRequiredConstantsRecord & HSWSOptionalConstantsRecord;

type HSWSConstantsExcludedKeys = Exclude<keyof HSWSConstants, keyof HSWSConstantsRecord>;
type HSWSConstantsType = Readonly<HSWSConstantsRecord & Record<HSWSConstantsExcludedKeys, never>>;

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
    for (const [[keys], validator] of new Map([
      [[HSWSRequiredConstants], this.required.bind(this)],
      [[HSWSOptionalConstants], this.optional.bind(this)],
    ])) {
      Object.defineProperties<typeof this>(
        this,
        Object.keys(keys).reduce((props, key) => {
          if (isNaN(Number(key))) {
            props[key] = { get: () => validator(key) };
          }
          return props;
        }, {} as PropertyDescriptorMap),
      );
    }
  }

  private required(key: string): string {
    const { [key]: value } = process.env;
    if (typeof value !== 'string' || value.trim() === '') {
      throw new HSWSError(`Required environment variable "${key}" not set or empty`);
    }
    return value.trim();
  }

  private optional(key: string): string | undefined {
    try {
      return this.required(key);
    } catch (e) {
      return void 0;
    }
  }
}

export const constants = Object.freeze(new HSWSConstants());

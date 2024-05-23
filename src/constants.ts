import { HSWSError } from './error';

const REQUIRED_ENVIRONMENT_VARIABLES_KEYS = [
  'HSWS_PORT',
  'HSWS_VERSION',
  'HSWS_REVISION',
  'HSWS_LOG_LEVEL',
  'HSWS_REDIS_HOST',
  'HSWS_REDIS_PORT',
  'HSWS_REDIS_PASSWORD',
  'STSA_SMART_APP_ID',
  'STSA_SMART_APP_CLIENT_ID',
  'STSA_SMART_APP_CLIENT_SECRET',
] as const;

const OPTIONAL_ENVIRONMENT_VARIABLES_KEYS = [
  'HSWS_REDIS_TLS_ENABLED',
  'HSWS_REDIS_DATABASE_NUMBER',
] as const;

type HSWSConstantsRecord<K extends readonly string[]> = Record<K[number], Readonly<string>>;
type HSWSRequiredConstantsRecord = Required<
  HSWSConstantsRecord<typeof REQUIRED_ENVIRONMENT_VARIABLES_KEYS>
>;
type HSWSOptionalConstantsRecord = Partial<
  HSWSConstantsRecord<typeof OPTIONAL_ENVIRONMENT_VARIABLES_KEYS>
>;
type HSWSConstantsRecords = HSWSRequiredConstantsRecord & HSWSOptionalConstantsRecord;
type HSWSConstantsType = Readonly<
  Record<Exclude<keyof HSWSConstants, keyof HSWSConstantsRecords>, never> & HSWSConstantsRecords
>;

class HSWSConstants implements HSWSConstantsType {
  public declare readonly HSWS_PORT: string;
  public declare readonly HSWS_VERSION: string;
  public declare readonly HSWS_REVISION: string;
  public declare readonly HSWS_LOG_LEVEL: string;
  public declare readonly HSWS_REDIS_HOST: string;
  public declare readonly HSWS_REDIS_PORT: string;
  public declare readonly HSWS_REDIS_PASSWORD: string;
  public declare readonly HSWS_REDIS_TLS_ENABLED?: string;
  public declare readonly HSWS_REDIS_DATABASE_NUMBER?: string;
  public declare readonly STSA_SMART_APP_ID: string;
  public declare readonly STSA_SMART_APP_CLIENT_ID: string;
  public declare readonly STSA_SMART_APP_CLIENT_SECRET: string;

  constructor() {
    for (const [[keys], validator] of new Map([
      [[REQUIRED_ENVIRONMENT_VARIABLES_KEYS], this.required],
      [[OPTIONAL_ENVIRONMENT_VARIABLES_KEYS], this.optional],
    ])) {
      Object.defineProperties(
        this,
        keys.reduce((props, key) => ({ ...props, [key]: { value: validator(key) } }), {}),
      );
    }
  }

  private required(envVarKey: string): string {
    const { [envVarKey]: envVar } = process.env;
    if (!this.isEnvVarFilled(envVar)) {
      throw new HSWSError(`Required environment variable ${envVarKey} is not set or empty`);
    }
    return envVar.trim();
  }

  private optional(envVarKey: string): string | undefined {
    try {
      return this.required(envVarKey);
    } catch (e) {
      return void 0;
    }
  }

  private isEnvVarFilled(envVar: string | undefined): envVar is string {
    return typeof envVar === 'string' && envVar.trim() !== '';
  }
}

export const constants = Object.freeze(new HSWSConstants());

import { HSWSError } from './error';

const {
  HSWS_PORT,
  HSWS_VERSION,
  HSWS_REVISION,
  HSWS_LOG_LEVEL,
  HSWS_REDIS_HOST,
  HSWS_REDIS_PORT,
  HSWS_REDIS_PASSWORD,
  HSWS_REDIS_TSL_ENABLED,
  HSWS_REDIS_DATABASE_NUMBER,
  STSA_SMART_APP_ID,
  STSA_SMART_APP_CLIENT_ID,
  STSA_SMART_APP_CLIENT_SECRET,
} = process.env;

class HSWSConstants {
  public readonly HSWS_PORT = this.required(HSWS_PORT);
  public readonly HSWS_VERSION = this.required(HSWS_VERSION);
  public readonly HSWS_REVISION = this.required(HSWS_REVISION);
  public readonly HSWS_LOG_LEVEL = this.required(HSWS_LOG_LEVEL);
  public readonly HSWS_REDIS_HOST = this.required(HSWS_REDIS_HOST);
  public readonly HSWS_REDIS_PORT = this.required(HSWS_REDIS_PORT);
  public readonly HSWS_REDIS_PASSWORD = this.required(HSWS_REDIS_PASSWORD);
  public readonly HSWS_REDIS_TSL_ENABLED = this.required(HSWS_REDIS_TSL_ENABLED);
  public readonly HSWS_REDIS_DATABASE_NUMBER = this.optional(HSWS_REDIS_DATABASE_NUMBER);
  public readonly STSA_SMART_APP_ID = this.required(STSA_SMART_APP_ID);
  public readonly STSA_SMART_APP_CLIENT_ID = this.required(STSA_SMART_APP_CLIENT_ID);
  public readonly STSA_SMART_APP_CLIENT_SECRET = this.required(STSA_SMART_APP_CLIENT_SECRET);

  private required(envVar: string | undefined): string {
    if (typeof envVar !== 'string' || envVar.trim().length === 0) {
      throw new HSWSError('Required environment variable is not set or empty');
    }
    return envVar;
  }

  private optional(envVar: string | undefined): string | undefined {
    if (typeof envVar !== 'string' || envVar.trim().length === 0) {
      return undefined;
    }
    return envVar;
  }
}

export const constants = new HSWSConstants();

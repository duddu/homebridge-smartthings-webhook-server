import { HSWSError } from './error';

class HSWSConstants {
  public readonly HSWS_PORT = this.required('HSWS_PORT');
  public readonly HSWS_VERSION = this.required('HSWS_VERSION');
  public readonly HSWS_REVISION = this.required('HSWS_REVISION');
  public readonly HSWS_LOG_LEVEL = this.required('HSWS_LOG_LEVEL');
  public readonly HSWS_REDIS_HOST = this.required('HSWS_REDIS_HOST');
  public readonly HSWS_REDIS_PORT = this.required('HSWS_REDIS_PORT');
  public readonly HSWS_REDIS_PASSWORD = this.required('HSWS_REDIS_PASSWORD');
  public readonly HSWS_REDIS_TLS_ENABLED = this.optional('HSWS_REDIS_TLS_ENABLED');
  public readonly HSWS_REDIS_DATABASE_NUMBER = this.optional('HSWS_REDIS_DATABASE_NUMBER');
  public readonly STSA_SMART_APP_ID = this.required('STSA_SMART_APP_ID');
  public readonly STSA_SMART_APP_CLIENT_ID = this.required('STSA_SMART_APP_CLIENT_ID');
  public readonly STSA_SMART_APP_CLIENT_SECRET = this.required('STSA_SMART_APP_CLIENT_SECRET');

  private required(envVarKey: string): string {
    const { [envVarKey]: envVar } = process.env;
    if (!this.isEnvVarFilled(envVar)) {
      throw new HSWSError(
        `Constants: ${envVarKey} required environment variable is not set or empty`,
      );
    }
    return envVar;
  }

  private optional(envVarKey: string): string | undefined {
    const { [envVarKey]: envVar } = process.env;
    if (!this.isEnvVarFilled(envVar)) {
      return undefined;
    }
    return envVar;
  }

  private isEnvVarFilled(envVar: string | undefined): envVar is string {
    return typeof envVar === 'string' && envVar.trim().length > 0;
  }
}

export const constants = new HSWSConstants();

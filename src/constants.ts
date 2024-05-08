const {
  HSWS_PORT,
  HSWS_VERSION,
  HSWS_REVISION,
  HSWS_LOG_LEVEL,
  STSA_SMART_APP_ID,
  STSA_SMART_APP_CLIENT_ID,
  STSA_SMART_APP_CLIENT_SECRET,
} = process.env;

class HSWSConstants {
  public readonly HSWS_PORT = this.validate(HSWS_PORT);
  public readonly HSWS_VERSION = this.validate(HSWS_VERSION);
  public readonly HSWS_REVISION = this.validate(HSWS_REVISION);
  public readonly HSWS_LOG_LEVEL = this.validate(HSWS_LOG_LEVEL);
  public readonly STSA_SMART_APP_ID = this.validate(STSA_SMART_APP_ID);
  public readonly STSA_SMART_APP_CLIENT_ID = this.validate(STSA_SMART_APP_CLIENT_ID);
  public readonly STSA_SMART_APP_CLIENT_SECRET = this.validate(STSA_SMART_APP_CLIENT_SECRET);

  private validate(envVar: string | undefined): string {
    if (typeof envVar !== 'string' || envVar.trim().length === 0) {
      throw new Error('Required environment variable is not set or empty');
    }
    return envVar;
  }
}

export const constants = new HSWSConstants();

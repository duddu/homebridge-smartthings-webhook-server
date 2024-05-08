const {
  HSWS_PORT,
  HSWS_VERSION,
  HSWS_LOG_LEVEL,
  STSA_SMART_APP_ID,
  STSA_SMART_APP_CLIENT_ID,
  STSA_SMART_APP_CLIENT_SECRET,
} = process.env;

class HSWSConstants {
  public get HSWS_PORT() {
    return this.validate(HSWS_PORT);
  }

  public get HSWS_VERSION() {
    return this.validate(HSWS_VERSION);
  }

  public get HSWS_LOG_LEVEL() {
    return this.validate(HSWS_LOG_LEVEL);
  }

  public get STSA_SMART_APP_ID() {
    return this.validate(STSA_SMART_APP_ID);
  }

  public get STSA_SMART_APP_CLIENT_ID() {
    return this.validate(STSA_SMART_APP_CLIENT_ID);
  }

  public get STSA_SMART_APP_CLIENT_SECRET() {
    return this.validate(STSA_SMART_APP_CLIENT_SECRET);
  }

  private validate(envVar: string | undefined): string {
    if (typeof envVar !== 'string' || envVar.trim().length === 0) {
      throw new Error('Required environment variable is not set or empty');
    }
    return envVar;
  }
}

export const constants = new HSWSConstants();

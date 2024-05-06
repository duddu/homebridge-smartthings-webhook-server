import { Logger as SmartAppLogger } from '@smartthings/smartapp/lib/util/log';
import winston, { config, format, Logform, LoggerOptions, transports } from 'winston';
import { stringify } from 'safe-stable-stringify';

const enum LoggerCategories {
  WebhookServer = 'HSWS',
  SmartApp = 'STSA',
}

const { combine, errors, label, printf, timestamp } = format;

const getLoggerFormat = (category: LoggerCategories): Logform.Format =>
  combine(
    timestamp(),
    errors({ stack: true }),
    label({ label: category }),
    printf(({ label, level, message, timestamp, ...rest }) => {
      let log = `${timestamp} [${label}] ${level}: ${message}`;
      const stringifiedRest = stringify(rest, void 0, 2);
      if (stringifiedRest !== '{}') {
        log += ` ${stringifiedRest}`;
      }
      return log;
    }),
  );

const commonLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL,
  levels: config.npm.levels,
  exitOnError: false,
  transports: [new transports.Console()],
};

winston.loggers.add(LoggerCategories.WebhookServer, {
  ...commonLoggerOptions,
  format: getLoggerFormat(LoggerCategories.WebhookServer),
  handleExceptions: true,
  handleRejections: true,
});

export const logger = winston.loggers.get(LoggerCategories.WebhookServer);

winston.loggers.add(LoggerCategories.SmartApp, {
  ...commonLoggerOptions,
  format: getLoggerFormat(LoggerCategories.SmartApp),
  handleExceptions: false,
  handleRejections: false,
});

const smartAppWinstonLogger = winston.loggers.get(LoggerCategories.SmartApp);

export const smartAppLogger: SmartAppLogger = Object.assign(smartAppWinstonLogger, {
  exception: (error: Error) => {
    if (error.stack) {
      smartAppWinstonLogger.error(error.stack);
    } else {
      smartAppWinstonLogger.error(error.toString());
    }
  },
});

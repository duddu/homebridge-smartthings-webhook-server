import { Logger as SmartAppLogger } from '@smartthings/smartapp/lib/util/log';
import winston, { config, format, Logform, LoggerOptions, transports } from 'winston';

import { constants } from './constants';

const enum LoggerCategories {
  WebhookServer = 'HSWS',
  SmartApp = 'STSA',
}

const { combine, errors, json, label, metadata, timestamp } = format;

const getLoggerFormat = (category: LoggerCategories): Logform.Format =>
  combine(
    timestamp(),
    label({ label: category }),
    errors({ stack: true }),
    metadata({ fillExcept: ['label', 'level', 'message', 'timestamp'] }),
    json(),
  );

const commonLoggerOptions: LoggerOptions = {
  level: constants.HSWS_LOG_LEVEL,
  levels: config.npm.levels,
  exitOnError: false,
  transports: [new transports.Console()],
};

winston.loggers.add(LoggerCategories.WebhookServer, {
  ...commonLoggerOptions,
  format: getLoggerFormat(LoggerCategories.WebhookServer),
  handleExceptions: true,
  handleRejections: false,
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

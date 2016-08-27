'use strict';

/**
 * This library should only be included once, as it configures Winston globally on initial execution
 */

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var winston = require('winston');
var WinstonDailyRotateFile = require('winston-daily-rotate-file');
var environment = require(path.join(__dirname, '/environment.js'));
var logDirectory = environment.getLogDirectory();
var logger;

function logTimeFormat() {
  return moment().format();
}

// Create the directory if it does not exist
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

logger = winston.loggers.get('logger');

logger.add(WinstonDailyRotateFile, {
  name: 'info-file',
  filename: logDirectory + '/iwannaseeit.log',
  level: 'info',
  timestamp: logTimeFormat
});
logger.add(WinstonDailyRotateFile, {
  name: 'error-file',
  filename: logDirectory + '/iwannaseeit_error.log',
  level: 'error',
  timestamp: logTimeFormat,
  handleExceptions: true,
  humanReadableUnhandledException: true
});

logger.remove(winston.transports.Console);

if (environment.isDevelopment()) {
  logger.add(winston.transports.Console, {
    level: 'silly',
    timestamp: logTimeFormat,
    colorize: true,
    handleExceptions: true,
    humanReadableUnhandledException: true
  });
}

module.exports = logger;

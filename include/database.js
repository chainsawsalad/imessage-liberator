'use strict';

var path = require('path');
var pg = require('pg');
var logger = require('winston').loggers.get('logger');
var databaseUrl = require(path.join(__dirname, '/environment.js')).getDbAddress();
var MAX_RETRY_COUNT = 3;
var RETRY_DELAY = 5000;

module.exports = function databaseConnect() {
  var retryCount = 0;
  return new Promise(function databaseConnectAttempt(resolve, reject) {
    pg.connect(databaseUrl, function (error, client, done) {
      if (error) {
        if (retryCount < MAX_RETRY_COUNT) {
          retryCount++;
          logger.warn('Rerying database connection (retry #%d)', retryCount);
          return setTimeout(function () {
            databaseConnectAttempt(resolve, reject);
          }, RETRY_DELAY);
        }
        return reject(error);
      }
      return resolve({
        client: client,
        done: done
      });
    });
  });
};

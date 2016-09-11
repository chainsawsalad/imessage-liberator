'use strict'; /* eslint-env node */

/** The following goes in /home/ec2-user/.bashrc:
 *
 * export NODE_ENV=production
 * export NODE_PATH=<path to node_modules>
 * export HTTP_PORT=5080
 * export HTTPS_PORT=5443
 */

var fs = require('fs');
var path = require('path');
var environment = require(path.join(__dirname, '/envConfig.json'));

module.exports.isProduction = function () {
  return process.env.NODE_ENV === 'production';
};

module.exports.isDevelopment = function () {
  return !module.exports.isProduction();
};

module.exports.getSslPrivateKey = function () {
  var httpsPath = environment.https.path;
  httpsPath = httpsPath ? httpsPath : path.join(__dirname, '..');
  return fs.readFileSync(path.join(httpsPath, environment.https.privateKey));
};

module.exports.getSslFullChain = function () {
  var httpsPath = environment.https.path;
  httpsPath = httpsPath ? httpsPath : path.join(__dirname, '..');
  return fs.readFileSync(path.join(httpsPath, environment.https.fullChain));
};

module.exports.getSslCertificateAuthority = function () {
  var fileName = environment.https.ca;
  var httpsPath = environment.https.path;
  if (fileName) {
    httpsPath = httpsPath ? httpsPath : path.join(__dirname, '..');
    return fs.readFileSync(path.join(httpsPath, environment.https.certificateAuthority));
  }
  return null;
};

module.exports.getLogDirectory = function () {
  if (!process.env.LOGGING_PATH) {
    return 'log';
  }
  return process.env.LOGGING_PATH;
};

module.exports.getDbAddress = function () {
  var config = environment.database;

  return 'postgres://' +
      config.user +
      (config.password ? ':' + config.password : '') +
      '@' +
      config.host +
      '/' +
      config.database;
};

module.exports.getLogPath = function () {
  return environment.log.path;
};

/**
 * http://stackoverflow.com/questions/6109089/how-do-i-run-node-js-on-port-80
 * Route port 80 to $HTTP_PORT: sudo iptables -A PREROUTING -t nat -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $HTTP_PORT
 * Undo route 80 to $HTTP_PORT: sudo iptables -D PREROUTING -t nat -i eth0 -p tcp --dport 80 -j REDIRECT --to-port $HTTP_PORT
 * View PREROUTING Rules: sudo iptables -L -vt nat
 *
 * @return {Number} Port to start the node server on
 */
module.exports.getInsecurePort = function () {
  return process.env.HTTP_PORT || 80;
};

/**
 * http://stackoverflow.com/questions/6109089/how-do-i-run-node-js-on-port-80
 * Route port 443 to $HTTPS_PORT: sudo iptables -A PREROUTING -t nat -i eth0 -p tcp --dport 443 -j REDIRECT --to-port $HTTPS_PORT
 * Undo route 443 to $HTTPS_PORT: sudo iptables -D PREROUTING -t nat -i eth0 -p tcp --dport 443 -j REDIRECT --to-port $HTTPS_PORT
 * View PREROUTING Rules: sudo iptables -L -vt nat
 *
 * @return {Number} Secure port to start the node server on
 */
module.exports.getSecurePort = function () {
  return process.env.HTTPS_PORT || 443;
};

module.exports.getIpAddress = function () {
  return '127.0.0.1';
};

module.exports.getHostAddress = function () {
  var address = process.env.DOCKER_HOST || '10.200.10.1';
  var port = process.env.IMESSAGE_LIBERATOR_PORT || '8999';
  return 'http://' + address + ':' + port + '/cgi-bin/liberator.py';
};

module.exports.getSlackOauthToken = function () {
  if (!process.env.SLACK_OAUTH_TOKEN) {
    throw new Error('Missing Slack OAuth token');
  }
  return process.env.SLACK_OAUTH_TOKEN;
};

if (module.exports.isDevelopment()) {
  environment = environment.development;
} else {
  environment = environment.production;
}

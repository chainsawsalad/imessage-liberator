var path = require('path');
var httpRequest = require('request');
var restify = require('restify');
var WebSocket = require('ws');
var logger = require(path.join(__dirname, '/include/logger.js'));
var environment = require(path.join(__dirname, '/include/environment.js'));
var slackOauthToken = environment.getSlackOauthToken();
var insecurePort = environment.getInsecurePort();

var Channel = {
  'SLACK': '0'
};

var connectedSocket = null;
var slackChannelNamesById = {};
var messagesToMeQueue = {};

messagesToMeQueue[Channel.SLACK] = [];


function slackLoadChannels() {
  var options = {
    url: 'https://slack.com/api/channels.list',
    method: 'GET',
    json: true,
    qs: {
      token: slackOauthToken
    }
  };

  return new Promise(function (resolve, reject) {
    httpRequest(options, function (error, response, body) {
      if (response.statusCode >= 400 || !body.ok) {
        reject(error || body.error);
      } else {
        slackChannelNamesById = {};
        body.channels.forEach(function (channel) {
          slackChannelNamesById[channel.id] = channel.name;
        });
        resolve(slackChannelNamesById);
      }
    });
  });
}

function slackAuthenticate() {
  var options = {
    url: 'https://slack.com/api/rtm.start',
    method: 'GET',
    json: true,
    qs: {
      token: slackOauthToken,
      simple_latest: true,
      no_unreads: true
    }
  };

  return new Promise(function (resolve, reject) {
    httpRequest(options, function (error, response, body) {
      if (response.statusCode >= 400 || !body.ok) {
        reject(error || body.error);
      } else {
        resolve(body.url);
      }
    });
  });
}

function generateSlackChannelName(channelName) {
  // Channel names must be 21 characters or fewer, lower case, and cannot contain spaces or periods.
  return channelName.toLowerCase().replace(/[\s\.]/g, '').slice(0, 21);
}

function slackJoinChannel(channelName) {
  var options = {
    url: 'https://slack.com/api/channels.join',
    method: 'GET',
    json: true,
    qs: {
      token: slackOauthToken,
      name: channelName
    }
  };

  return new Promise(function (resolve, reject) {
    httpRequest(options, function (error, response, body) {
      if (response.statusCode >= 400 || !body.ok) {
        reject(error || body.error);
      } else {
        logger.debug('Slack `channels.join` success', body);
        slackChannelNamesById[body.channel.id] = body.channel.name;
        resolve(body.channel.id);
      }
    });
  });
}

/**
function slackEventSendMessage(body, channelName, sender, senderImage) {
  var options = {
    url: 'https://slack.com/api/chat.postMessage',
    method: 'POST',
    json: true,
    form: {
      token: slackOauthToken,
      channel: channelName,
      username: sender,
      text: body,
      icon_emoji: ':dog2:'
    }
  };

  if (senderImage) {
    options.icon_url = senderImage;
    delete options.icon_emoji;
  }

  return new Promise(function (resolve, reject) {
    httpRequest(options, function (error, response, body) {
      if (response.statusCode >= 400 || !body.ok) {
        reject(error || body.error);
      } else {
        resolve(body.message.text);
      }
    });
  });
}
*/

function flushMessageQueue(channel) {
  messagesToMeQueue[channel].forEach(function (message) {
    // TODO: connectedSocket should be organized in a way that is channel specific
    sendMessage(connectedSocket, message);
  });
  messagesToMeQueue[channel] = [];
}

function sendMessage(socket, message) {
  socket.send(JSON.stringify(message));
  logger.verbose('Message sent', message);
}

function slackRtmSendMessage(channelId, message) {
  var slackMessage = {
    token: slackOauthToken,
    type: 'chat.postMessage',
    channel: channelId,
    username: message.sender,
    text: message.body,
    icon_emoji: ':dog2:'
  };

  if (message.senderImage) {
    slackMessage.icon_url = message.senderImage;
    delete slackMessage.icon_emoji;
  }

  if (connectedSocket === null || connectedSocket.readyState !== WebSocket.OPEN) {
    messagesToMeQueue[Channel.SLACK].push(slackMessage);
    logger.warn('Queuing Slack message', slackMessage);
  } else {
    sendMessage(connectedSocket, slackMessage);
  }
}

function messageToMe(request, response, next) {
  var message = {
    body: request.params.body,
    sender: request.params.sender,
    senderImage: request.params.senderImage
  };

  // TODO: determine if this message goes out to slack or some other `Channel`

  slackJoinChannel(generateSlackChannelName(message.sender))
  .then(function (channelId) {
    slackRtmSendMessage(channelId, message);
    return Promise.resolve();
  }).then(function () {
    logger.debug('Slack message success');
  }).catch(function (error) {
    logger.error('Failure in sending Slack message', error);
  });

  logger.info('Message to me received', message);

  response.send(request.params);
  next();
}

function messageFromMe(message) {
  logger.info('Message from me sent', message);
}

function connectSlackSocket(socketUrl) {
  return new Promise(function (resolve, reject) {
    var onError = function onError(error) {
      logger.error('Error encountered on websocket connection', error);
      reject(error);
    };
    var onMessage = function onMessage(data) {
      var message = JSON.parse(data);
      if (message.type === 'hello') {
        logger.verbose('Slack `hello` received');
        socket.removeListener('error', onError);
        socket.removeListener('message', onMessage);
        return resolve(socket);
      }
      logger.verbose('Unexpected Slack response received');
      return reject(message);
    };
    var ackTimeoutPid = setTimeout(function () {
      logger.verbose('Timeout occurred waiting for Slack acknowledgement');
      socket.close();
      return reject('timeout');
    }, 30000);
    var socket = new WebSocket(socketUrl);

    socket.on('open', function onOpen() {
      logger.verbose('Websocket connected successfully to %s', socketUrl);
      clearTimeout(ackTimeoutPid);
      socket.removeListener('open', onOpen);
    });
    socket.on('error', onError);
    socket.on('message', onMessage);
  });
}

function startRestServer() {
  var server = restify.createServer();
  server.use(restify.bodyParser());
  server.pre(restify.pre.userAgentConnection());

  return new Promise(function (resolve, reject) {
    server.listen(insecurePort, function () {
      logger.verbose('%s listening at %s', server.name, server.url);
      resolve(server);
    }).on('error', function (message) {
      logger.error('Error encountered on %s at %s', server.name, server.url);
      reject(message);
    });
  });
}

function listenToSlackSocketEndpoints(socket) {
  var reconnectUrl = null;

  socket.on('error', function (error) {
    logger.error('Socket error encountered', error);
    reconnectSlackSocket(reconnectUrl);
  });

  socket.on('close', function () {
    connectedSocket = null;
  });

  socket.on('message', function (data) {
    var message = data;

    try {
      message = JSON.parse(message);
    } catch (error) {
      logger.warn('Received invalid JSON format for Slack', message);
    }

    logger.silly('Slack `message` event received', message);

    switch (message.type) {
      case 'error':
        logger.error('Received Slack error', message);
        break;

      case 'reconnect_url':
        // https://api.slack.com/events/reconnect_url
        reconnectUrl = message.url;
        break;

      case 'message':
        // https://api.slack.com/events/message
        if (typeof message.reply_to === 'number') {
          logger.verbose('Sent Slack message confirmed', message);
        } else {
          messageFromMe({
            messageTo: slackChannelNamesById[message.channel],
            body: message.text
          });
        }
        break;

      default:
        // ignore all other messages
        logger.debug('Unexpected Slack event received', message);
        break;
    }
  });

  connectedSocket = socket;
}

function reconnectSlackSocket(reconnectUrl) {
  var onSocketReconnect = function (reconnectedSocket) {
    logger.info('Reconnected socket successfully to %s', reconnectUrl);
    listenToSlackSocketEndpoints(reconnectedSocket);
    flushMessageQueue(Channel.SLACK);
  };
  var retrySocketConnect = function (error) {
    var retryTime = 10000;
    logger.error('Failure on reconnection of socket, trying again in %d', retryTime, error);
    setTimeout(function () {
      slackAuthenticate().then(connectSlackSocket).then(onSocketReconnect).catch(retrySocketConnect);
    }, retryTime);
  };

  if (reconnectUrl) {
    return connectSlackSocket(reconnectUrl).then(onSocketReconnect).catch(retrySocketConnect);
  }

  return slackAuthenticate().then(connectSlackSocket).then(onSocketReconnect).catch(retrySocketConnect);
}

function listenToRestEndpoints(server) {
  server.post('/message/receive', function (request, response, next) {
    messageToMe(request, response, next);
  });
}

Promise.all([
  slackLoadChannels(),
  slackAuthenticate().then(connectSlackSocket),
  startRestServer()
]).then(function (values) {
  // need channels to load before listening begins
  listenToSlackSocketEndpoints(values[1]);
  listenToRestEndpoints(values[2]);

  logger.info('Startup completed successfully');
}, function (error) {
  logger.error('Fatal error starting server', error);
});


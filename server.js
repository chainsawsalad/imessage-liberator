var path = require('path');
var httpRequest = require('request');
var restify = require('restify');
var WebSocket = require('ws');
var logger = require(path.join(__dirname, '/include/logger.js'));
var environment = require(path.join(__dirname, '/include/environment.js'));
var slackOauthToken = environment.getSlackOauthToken();
var insecurePort = environment.getInsecurePort();

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
        resolve(body.channel.name);
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

function slackRtmSendMessage(socket, body, channelName, sender, senderImage) {
  var message = {
    token: slackOauthToken,
    channel: channelName,
    username: sender,
    text: body,
    icon_emoji: ':dog2:'
  };

  if (senderImage) {
    message.icon_url = senderImage;
    delete message.icon_emoji;
  }

  socket.emit('message', message);
}

function messageToMe(socket, request, response, next) {
  var body = request.params.body;
  var sender = request.params.sender;
  var senderImage = request.params.senderImage;

  slackJoinChannel(generateSlackChannelName(sender))
  .then(function (channelName) {
    slackRtmSendMessage(socket, body, channelName, sender, senderImage);
    return Promise.resolve();
  }).then(function () {
    logger.verbose('Slack message success');
  }).catch(function (error) {
    logger.error('Failure in sending Slack message', error);
  });

  logger.info('Message to me received: %s from %s', body, sender);

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

function startRestServer(socket) {
  var server = restify.createServer();
  server.use(restify.bodyParser());
  server.pre(restify.pre.userAgentConnection());
  server.post('/message/receive', function (request, response, next) {
    messageToMe(socket, request, response, next);
  });

  socket.on('error', function (error) {
    logger.error('Socket error encountered', error);
  });
  socket.on('message', function (data) {
    var message = JSON.parse(data);
    messageFromMe(message);
  });

  return new Promise(function (resolve, reject) {
    server.listen(insecurePort, function () {
      logger.verbose('%s listening at %s', server.name, server.url);
      resolve();
    }).on('error', function (message) {
      logger.error('Error encountered on %s at %s', server.name, server.url);
      reject(message);
    });
  });
}


slackAuthenticate()
.then(connectSlackSocket)
.then(startRestServer)
.then(function () {
  logger.info('Startup completed successfully');
}).catch(function (error) {
  logger.error('Fatal error starting server', error);
});

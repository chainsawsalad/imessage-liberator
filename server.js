var path = require('path');
var httpRequest = require('request');
var restify = require('restify');
var logger = require(path.join(__dirname, '/include/logger.js'));
var environment = require(path.join(__dirname, '/include/environment.js'));
var slackOauthToken = environment.getSlackOauthToken();
var insecurePort = environment.getInsecurePort();

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

function slackSendMessage(body, channelName, sender, senderImage) {
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

function messageReceived(request, response, next) {
  var body = request.params.body;
  var sender = request.params.sender;
  var senderImage = request.params.senderImage;

  slackJoinChannel(generateSlackChannelName(sender))
  .then(function (channelName) {
    return slackSendMessage(body, channelName, sender, senderImage);
  }).then(function (result) {
    logger.verbose('Slack message success', result);
  }).catch(function (error) {
    logger.error('Failure in sending Slack message', error);
  });

  logger.info('Message received: %s from %s', body, sender);

  response.send(request.params);
  next();
}

function messageSent(request, response, next) {
  logger.info('Message sent: %s to %s', request.params.body, request.params.receiver);
  response.send(request.params);
  next();
}

var server = restify.createServer();
server.use(restify.bodyParser());
server.pre(restify.pre.userAgentConnection());
server.post('/message/receive', messageReceived);
server.post('/message/send', messageSent);

server.listen(insecurePort, function () {
  logger.info('%s listening at %s', server.name, server.url);
});

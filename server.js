var path = require('path');
var restify = require('restify');
var httpRequest = require('request');

var SlackClient = require('@slack/client');
var SlackRtmClient = SlackClient.RtmClient;
var SlackWebClient = require('@slack/client').WebClient;
var SLACK_RTM_CLIENT_EVENTS = SlackClient.CLIENT_EVENTS.RTM;
var SLACK_RTM_EVENTS = SlackClient.RTM_EVENTS;
var logger = require(path.join(__dirname, '/include/logger.js'));
var environment = require(path.join(__dirname, '/include/environment.js'));
var slackOauthToken = environment.getSlackOauthToken();
var insecurePort = environment.getInsecurePort();
var hostAddress = environment.getHostAddress();

var Channel = {
  'SLACK': '0'
};


var senderHandleBySlackChannelIds = {}; // mapping of Slack channel to iMessage buddy
var slackChannelIdsByName = {}; // if we have a record of the channel here, we assume we've joined
var channelTransports = {};
var messagesToMeQueue = {};

channelTransports[Channel.SLACK] = {
  web: new SlackWebClient(slackOauthToken),
  rtm: null
};
messagesToMeQueue[Channel.SLACK] = [];


function slackConnectRtmClient() {
  return new Promise(function (resolve, reject) {
    var rtm = new SlackRtmClient(slackOauthToken, {
      //logLevel: 'debug'
    });
    var rejectPid = null;

    rtm.on(SLACK_RTM_CLIENT_EVENTS.AUTHENTICATED, function (event) {
      logger.verbose('Logged into Slack as %s of team %s', event.self.name, event.team.name);
    });

    rtm.on(SLACK_RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
      logger.verbose('Slack connection opened');
      clearTimeout(rejectPid);
      resolve(rtm);
    });

    rtm.on(SLACK_RTM_CLIENT_EVENTS.UNABLE_TO_RTM_START, function (event) {
      rejectPid = setTimeout(function () {
        reject(event);
      }, 10000);
    });

    rtm.on(SLACK_RTM_CLIENT_EVENTS.RAW_MESSAGE, function (event) {
      logger.silly('Slack event encountered', event);
    });

    rtm.start();
  });
}

function listenToSlackRtmEndpoints(rtm) {
  rtm.on(SLACK_RTM_CLIENT_EVENTS.ATTEMPTING_RECONNECT, function () {
    logger.warn('Slack reconnecting to API');
  });

  rtm.on(SLACK_RTM_CLIENT_EVENTS.DISCONNECT, function () {
    logger.error('Slack disconnected from API');
    channelTransports[Channel.SLACK].rtm = null;
    slackConnectRtmClient().then(listenToSlackRtmEndpoints);
  });

  rtm.on(SLACK_RTM_EVENTS.MESSAGE, function (message) {
    logger.silly('Slack `message` event received', message);
    messageFromMe({
      messageTo: senderHandleBySlackChannelIds[message.channel],
      body: message.text
    });
  });

  channelTransports[Channel.SLACK].rtm = rtm;
}

function slackLoadChannels() {
  return channelTransports[Channel.SLACK].web.channels.makeAPICall('channels.list')
  .then(function (response) {
    var channelIdsByName = {};
    logger.debug('Slack `channels.list` success', response);
    response.channels.forEach(function (channel) {
      channelIdsByName[channel.name] = channel.id;
    });
    return channelIdsByName;
  });
}

function slackJoinChannel(channelName) {
  if (slackChannelIdsByName[channelName]) {
    return Promise.resolve(slackChannelIdsByName[channelName]);
  } else {
    return channelTransports[Channel.SLACK].web.channels.makeAPICall('channels.join', {
      name: channelName
    }).then(function (response) {
      logger.debug('Slack `channels.join` success', response);
      slackChannelIdsByName[response.channel.name] = response.channel.id;
      return response.channel.id;
    });
  }
}

function slackSendMessage(channelId, message) {
  var options = {
    channel: channelId,
    username: message.senderName,
    text: message.body,
    icon_emoji: ':dog2:'
  };

  if (message.senderImage) {
    options.icon_url = message.senderImage;
    delete options.icon_emoji;
  }

  return channelTransports[Channel.SLACK].web.chat.makeAPICall('chat.postMessage', options)
  .then(function (response) {
    logger.debug('Slack `chat.postMessage` success', response);
    return response.message.text;
  });
}

function generateSlackChannelName(channelName) {
  // Channel names must be 21 characters or fewer, lower case, and cannot contain spaces or periods.
  return (channelName || '').toLowerCase().replace(/[\s\.]/g, '').slice(0, 21);
}

function sendMessage(message) {
  var channelUserMessageQueue = messagesToMeQueue[Channel.SLACK];
  var newChannelName = generateSlackChannelName(message.senderName);

  // TODO: determine if this message goes out to Slack or some other `Channel`

  slackJoinChannel(newChannelName)
  .then(function (channelId) {
    senderHandleBySlackChannelIds[channelId] = message.senderHandle;
    return slackSendMessage(channelId, message);
  }).then(function () {
    logger.debug('Slack message success');
    channelUserMessageQueue[message.senderName].shift();
    if (channelUserMessageQueue[message.senderName].length > 0) {
      logger.debug('Processing Slack queue message');
      sendMessage(channelUserMessageQueue[message.senderName][0]);
    }
  }).catch(function (error) {
    logger.error('Failure in sending Slack message', error);
  });
}

function messageToMe(request, response, next) {
  var message = {
    body: request.params.body,
    senderHandle: request.params.senderHandle,
    senderName: request.params.senderName,
    senderImage: request.params.senderImage
  };
  var channelUserMessageQueue = messagesToMeQueue[Channel.SLACK];

  logger.info('Message to me received', message);

  if (!message.body || !message.senderHandle) {
    message.error = 'Missing required message fields';
    response.send(500, message);
    return next(message.error);
  }

  if ((channelUserMessageQueue[message.senderName] || []).length > 0) {
    logger.debug('Queuing Slack message', message);
    channelUserMessageQueue[message.senderName].push(message);
  } else {
    channelUserMessageQueue[message.senderName] = [
      message
    ];
    sendMessage(message);
  }

  response.send(message);
  return next();
}

function messageFromMe(message) {
  httpRequest({
    url: hostAddress,
    method: 'POST',
    json: true,
    form: message
  }, function (error, response, body) {
    if (error || response.statusCode >= 400 || !body.ok) {
      logger.error('Message from me failed to send: %s', error || body, message);
    } else {
      logger.info('Message from me sent', message, body);
    }
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

function listenToRestEndpoints(server) {
  server.post('/message/receive', function (request, response, next) {
    messageToMe(request, response, next);
  });
}

Promise.all([
  slackLoadChannels(),
  slackConnectRtmClient(),
  startRestServer()
]).then(function (values) {
  // need channels to load before listening begins
  slackChannelIdsByName = values[0];
  listenToSlackRtmEndpoints(values[1]);
  listenToRestEndpoints(values[2]);

  logger.info('Startup completed successfully');
}, function (error) {
  logger.error('Fatal error starting server', error);
});


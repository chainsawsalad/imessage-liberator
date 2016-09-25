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

var Buddy = require(path.join(__dirname, '/include/Buddy.js'));
var Contact = require(path.join(__dirname, '/include/Contact.js'));
var ChannelMapping = require(path.join(__dirname, '/include/ChannelMapping.js'));
var contactMappingManager = require(path.join(__dirname, '/include/contactMappingManager.js'));

var slackOauthToken = environment.getSlackOauthToken();
var insecurePort = environment.getInsecurePort();
var hostAddress = environment.getHostAddress();

var senderHandleBySlackChannelIds = {}; // mapping of Slack channel to iMessage buddy

var channelMappingsByImessageId = {};
var channelTransports = {};
var messagesToMeQueue = {};

channelMappingsByImessageId[ChannelMapping.MessageChannel.SLACK] = {};
channelTransports[ChannelMapping.MessageChannel.SLACK] = {
  web: new SlackWebClient(slackOauthToken),
  rtm: null
};
messagesToMeQueue[ChannelMapping.MessageChannel.SLACK] = [];


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
    channelTransports[ChannelMapping.MessageChannel.SLACK].rtm = null;
    slackConnectRtmClient().then(listenToSlackRtmEndpoints);
  });

  rtm.on(SLACK_RTM_EVENTS.MESSAGE, function (message) {
    var recipientHandle;

    // only listen to pure messages
    if (!message.subtype) {
      logger.debug('Slack `message` event received', message);

      recipientHandle = senderHandleBySlackChannelIds[message.channel];
      if (!recipientHandle) {
        logger.warn('Message from me not sent: Unknown recipient handle for channel', message);
      } else {
        messageFromMe({
          messageTo: recipientHandle,
          body: message.text
        });
      }
    } else if (message.subtype === 'file_share') {
      // TODO: implement file sharing
      logger.debug('Slack `message.file_share` event received', message);
    }
  });

  channelTransports[ChannelMapping.MessageChannel.SLACK].rtm = rtm;
}

function slackJoinChannel(channelName) {
  return channelTransports[ChannelMapping.MessageChannel.SLACK].web.channels.makeAPICall('channels.join', {
    name: channelName
  }).then(function (response) {
    logger.debug('Slack `channels.join` success', response);
    return Promise.resolve(response.channel.id);
  });
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

  return channelTransports[ChannelMapping.MessageChannel.SLACK].web.chat.makeAPICall('chat.postMessage', options)
  .then(function (response) {
    logger.debug('Slack `chat.postMessage` success', response);
    return response.message.text;
  });
}

function generateSlackChannelName(channelName) {
  // Channel names must be 21 characters or fewer, lower case, and cannot contain spaces or periods.
  return (channelName || '').toLowerCase().replace(/[\s\.]/g, '').slice(0, 21);
}

function deliverMessage(channelMapping, message, imessageId) {
  return slackSendMessage(channelMapping.getChannelKey(), message)
  // remove this message from the queue and check if another exists for this buddy
  // if so, deliver it
  .then(function () {
    var channelUserMessageQueue = messagesToMeQueue[ChannelMapping.MessageChannel.SLACK];

    logger.debug('Slack message success');
    channelUserMessageQueue[imessageId].shift();

    if (channelUserMessageQueue[imessageId].length > 0) {
      logger.debug('Processing Slack queue message');
      deliverMessage(channelMapping, channelUserMessageQueue[imessageId][0], imessageId);
    }
  }).catch(function (reason) {
    logger.error('Failure in sending Slack message', reason);
  });
}

function buildChannelMapping(theBuddy, message) {
  var channelName = null;
  var buddy = theBuddy;
  if (buddy.getContact() === null) {
    buddy.setContact(new Contact({
      imessageId: message.senderImessageId,
      name: message.senderName
    }));
  }

  // save the contact in the db
  return contactMappingManager.saveBuddy(buddy)
  // join (or create) the slack channel corresponding to this contact
  .then(function (savedBuddy) {
    buddy = savedBuddy;
    channelName = generateSlackChannelName(buddy.getContact().getName());
    return slackJoinChannel(channelName);
  })
  // save the mapping of this contact to the joined (or created) channel key
  .then(function (channelKey) {
    var channelMapping = new ChannelMapping({
      messageChannel: ChannelMapping.MessageChannel.SLACK,
      contactId: buddy.getContact().getId(),
      channelKey: channelKey,
      channelName: channelName
    });
    return contactMappingManager.saveChannelMapping(channelMapping);
  })
  // now the message can be delivered
  .then(function (savedChannelMapping) {
    var imessageId = buddy.getContact().getImessageId();
    channelMappingsByImessageId[ChannelMapping.MessageChannel.SLACK][imessageId] = savedChannelMapping;
    return deliverMessage(savedChannelMapping, message, imessageId);
  });
}

function messageToMe(request, response, next) {
  var message = {
    body: request.params.body,
    senderImessageId: request.params.senderImessageId,
    senderHandle: request.params.senderHandle,
    senderName: request.params.senderName,
    senderImage: request.params.senderImage
  };
  var slackChannelUserMessageQueue = messagesToMeQueue[ChannelMapping.MessageChannel.SLACK];
  var slackChannelMappingsByImessageId = channelMappingsByImessageId[ChannelMapping.MessageChannel.SLACK];
  var imessageId = message.senderImessageId;

  logger.info('Message to me received', message);

  if (!message.body || !message.senderHandle || !imessageId) {
    message.error = 'Missing required message fields';
    response.send(500, message);
    return next(message.error);
  }

  // there is already a message in the queue
  if ((slackChannelUserMessageQueue[imessageId] || []).length > 0) {
    logger.debug('Queuing Slack message', message);
    slackChannelUserMessageQueue[message.senderName].push(message);

  // the queue is empty
  } else {
    slackChannelUserMessageQueue[imessageId] = [
      message
    ];
    if (slackChannelMappingsByImessageId[imessageId]) {
      return deliverMessage(slackChannelMappingsByImessageId[imessageId], message, imessageId);
    }
    // see if a channel mapping exists for this buddy
    return contactMappingManager.getContactChannelMappingByImessageId(imessageId, ChannelMapping.MessageChannel.SLACK)
    .then(function (result) {
      var buddy = new Buddy({
        contact: result.contact,
        handle: message.senderHandle
      });
      var imessageId = null;

      if (result.channelMapping === null || result.contact === null) {
        logger.info('Unknown contact mapping', message);
        return buildChannelMapping(buddy, message);
      }

      imessageId = result.contact.getImessageId();
      slackChannelMappingsByImessageId[imessageId] = result.channelMapping;
      return deliverMessage(result.channelMapping, message, imessageId);
    })
    .catch(function (reason) {
      logger.error('Failure sending message to me', reason);
    });
  }

  response.send(message);
  return next();
}

function messageFromMe(message) {
  httpRequest({
    url: hostAddress + 'liberator.py',
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

function parseBuddies(payload) {
  var buddies = [];
  var contactResult = null;

  try {
    contactResult = JSON.parse(payload.body);
  } catch (error) {
    logger.error('Contacts JSON payload is malformed', payload, error);
    return Promise.reject(new Error('Malformed JSON payload'));
  }

  (contactResult.errors || []).forEach(function (error) {
    logger.warn('Host encountered error while parsing contacts:', error);
  });

  contactResult.buddies.forEach(function (buddy) {
    logger.info('Buddy loading from contacts', buddy);
    buddies.push(new Buddy({
      contact: new Contact(buddy),
      handle: buddy.handle
    }));
  });

  return buddies;
}

/**
 * Request the Buddy contacts from the Host
 */
function fetchBuddiesFromHost() {
  return new Promise(function (resolve, reject) {
    httpRequest({
      url: hostAddress + 'contacts.py',
      method: 'GET',
      json: true
    }, function (error, response, body) {
      if (error || response.statusCode >= 400 || !(body || {}).ok) {
        logger.error('Failure to fetch contacts from host', error || body);
        reject(error || body);
      } else {
        logger.info('Contacts fetched from host');
        resolve(parseBuddies(body));
      }
    });
  });
}

/**
 * Get all host contacts and ensure they are stored in the database along with
 * their mappings to a message channel
 */
function processContacts() {
  var channelNames = [];
  var contacts = [];

  return fetchBuddiesFromHost()
  // save newly parsed buddies to db
  .then(function (buddies) {
    return contactMappingManager.batchDatabaseOpperation(contactMappingManager.saveBuddy, buddies);
  })
  .then(function (result) {
    logger.silly('Success fetching and storing contacts', result);

    // buddy contacts have been fetched from host and stored
    // now we make sure for each one there is a corresponding message channel key
    return contactMappingManager.getAllChannelMappingsByContact();
  })
  .then(function (contactAndChannelMappingPairs) {
    var batchOperations = [];

    // loop through the contacts and select those without channel mappings
    contactAndChannelMappingPairs.forEach(function (result) {
      var newChannelName;
      var joinPromise;
      if (result.channelMapping === null) {
        newChannelName = generateSlackChannelName(result.contact.getName());
        joinPromise = slackJoinChannel(newChannelName)
        .then(function (channelId) {
          logger.silly('Joined Slack channel `%s` (%s)', newChannelName, channelId);
          return Promise.resolve(channelId);
        });
        channelNames.push(newChannelName);
        contacts.push(result.contact);
        batchOperations.push(joinPromise);
      } else {
        channelMappingsByImessageId[ChannelMapping.MessageChannel.SLACK][result.contact.getImessageId()] = result.channelMapping;
      }
    });

    if (batchOperations.length === 0) {
      return Promise.resolve();
    }

    // create channel mapping keys for the contacts without mappings yet
    return Promise.all(batchOperations)
    // at this time all message channel keys have been created and joined
    // now we will store this information as channel mappings
    .then(function (channelIds) {
      var contactMappings = [];

      channelIds.forEach(function (channelId, index) {
        contactMappings.push(new ChannelMapping({
          messageChannel: ChannelMapping.MessageChannel.SLACK,
          contactId: contacts[index].getId(),
          channelKey: channelId,
          channelName: channelNames[index]
        }));
      });

      return contactMappingManager.batchDatabaseOpperation(contactMappingManager.saveChannelMapping, contactMappings);
    })
    .then(function (channelMappings) {
      channelMappings.forEach(function (channelMapping, index) {
        channelMappingsByImessageId[ChannelMapping.MessageChannel.SLACK][contacts[index].getImessageId()] = channelMapping;
      });
      return Promise.resolve();
    });
  })
  .catch(function (reason) {
    logger.warn('Failure processing host contacts', reason);
    return Promise.reject(reason);
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

processContacts()
.then(function () {
  return Promise.all([
    slackConnectRtmClient(),
    startRestServer(),
  ])
  .then(function (values) {
    listenToSlackRtmEndpoints(values[0]);
    listenToRestEndpoints(values[1]);
    logger.info('Startup completed successfully');
    return Promise.resolve();
  })
  .catch(function (reason) {
    logger.error('Fatal error starting server', reason);
  });
})
.catch(function (reason) {
  logger.error('Fatal error fetching Slack channels', reason);
});

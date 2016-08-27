var path = require('path');
var logger = require(path.join(__dirname, '/include/logger.js'));
var restify = require('restify');


function messageReceived(request, response, next) {
  logger.info('Message received: %s from %s', request.params.body, request.params.sender);
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

server.listen(80, function () {
  logger.info('%s listening at %s', server.name, server.url);
});

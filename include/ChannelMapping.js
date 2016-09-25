'use strict';

function ChannelMapping(settings) {
  this.setId(settings.id);
  this.setMessageChannel(settings.messageChannel);
  this.setContactId(settings.contactId);
  this.setChannelKey(settings.channelKey);
  this.setChannelName(settings.channelName);
}

module.exports = ChannelMapping;

var MessageChannel = {
  'SLACK': 0,
  '0': 'SLACK'
};
ChannelMapping.MessageChannel = MessageChannel;

ChannelMapping.prototype.setId = function (id) {
  this._id = id;
};

ChannelMapping.prototype.getId = function () {
  return this._id || null;
};

ChannelMapping.prototype.setMessageChannel = function (messageChannel) {
  if (typeof messageChannel === 'number') {
    messageChannel = MessageChannel[messageChannel];
  }
  this._messageChannel = messageChannel;
};

ChannelMapping.prototype.getMessageChannel = function () {
  return this._messageChannel || null;
};

ChannelMapping.prototype.setContactId = function (contactId) {
  this._contactId = contactId;
};

ChannelMapping.prototype.getContactId = function () {
  return this._contactId || null;
};

ChannelMapping.prototype.setChannelKey = function (channelKey) {
  this._channelKey = channelKey;
};

ChannelMapping.prototype.getChannelKey = function () {
  return this._channelKey || null;
};

ChannelMapping.prototype.setChannelName = function (channelName) {
  this._channelName = channelName;
};

ChannelMapping.prototype.getChannelName = function () {
  return this._channelName || null;
};

ChannelMapping.prototype.toJson = function () {
  return {
    id: this.getId(),
    messageChannel: this.getMessageChannel(),
    contactId: this.getContactId(),
    channelKey: this.getChannelKey(),
    channelName: this.getChannelName()
  };
};

ChannelMapping.prototype.serialize = function () {
  return JSON.stringify(this.toJson(), null, 4);
};

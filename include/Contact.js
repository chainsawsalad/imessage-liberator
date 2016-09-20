'use strict';

function Contact(settings) {
  this.setId(settings.id);
  this.setImessageId(settings.imessageId);
  this.setName(settings.name);
  this.setHandle(settings.handle);
}

module.exports = Contact;

Contact.prototype.setId = function (id) {
  this._id = id;
};

Contact.prototype.getId = function () {
  return this._id || null;
};

Contact.prototype.setImessageId = function (imessageId) {
  this._imessageId = imessageId;
};

Contact.prototype.getImessageId = function () {
  return this._imessageId || null;
};

Contact.prototype.setName = function (name) {
  this._name = name;
};

Contact.prototype.getName = function () {
  return this._name || null;
};

Contact.prototype.setHandle = function (handle) {
  this._handle = handle;
};

Contact.prototype.getHandle = function () {
  return this._handle || null;
};

Contact.prototype.toJson = function () {
  return {
    id: this.getId(),
    imessageId: this.getImessageId(),
    name: this.getName(),
    handle: this.getHandle(),
  };
};

Contact.prototype.serialize = function () {
  return JSON.stringify(this.toJson(), null, 4);
};

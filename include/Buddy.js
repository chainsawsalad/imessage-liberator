'use strict';

function Buddy(settings) {
  this.setContact(settings.contact);
  this.setHandle(settings.handle);
  this.setDisabled(settings.disabled);
}

module.exports = Buddy;

Buddy.prototype.setContact = function (contact) {
  this._contact = contact;
};

Buddy.prototype.getContact = function () {
  return this._contact || null;
};

Buddy.prototype.setHandle = function (handle) {
  this._handle = handle;
};

Buddy.prototype.getHandle = function () {
  return this._handle || null;
};

Buddy.prototype.setDisabled = function (disabled) {
  this._disabled = !!disabled;
};

Buddy.prototype.isDisabled = function () {
  return this._disabled || false;
};

Buddy.prototype.toJson = function () {
  return {
    contact: this.getContact().toJson(),
    handle: this.getHandle(),
    disabled: this.isDisabled()
  };
};

Buddy.prototype.serialize = function () {
  return JSON.stringify(this.toJson(), null, 4);
};

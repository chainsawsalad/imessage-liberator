'use strict';

var path = require('path');
var logger = require('winston').loggers.get('logger');
var databaseConnect = require(path.join(__dirname, '/database.js'));
var Contact = require(path.join(__dirname, '/Contact.js'));

var contactColumnMapping = 'contact.imessage_id AS "id", contact.full_name AS "name", contact_handle.handle';

function saveContact(contact, client) {
  var context = {
    client: client
  };
  return new Promise(function (resolve, reject) {
    if (typeof client === 'undefined') {
      return databaseConnect()
      .catch(reject)
      .then(function (databaseCallbacks) {
        context.client = databaseCallbacks.client;
        context.done = databaseCallbacks.done;
      })
      .then(resolve);
    }
    return resolve();
  })
  .then(function () {
    return getContact(contact, context.client);
  })
  .then(function (contact) {
    if (contact === null) {
      return createContact(contact, context.client);
    }
    logger.debug('Contact already exists', contact);
    return Promise.resolve();
  })
  .catch(function (error) {
    logger.error('Failure to save contact', error);
  })
  .then(function () {
    if (typeof context.done === 'function') {
      context.done();
      context = null;
    }
  });
}
module.exports.saveContact = saveContact;

/**
 * Create a new contact
 * @param {Contact} contact - The contact to create
 * @return {Promise} callback - The callback function run on completion
 */
function createContact(contact) {
  var context = {};
  var newContact = new Contact();
  return new Promise(function (resolve, reject) {
    if (typeof client === 'undefined') {
      return databaseConnect()
      .catch(reject)
      .then(function (databaseCallbacks) {
        context.client = databaseCallbacks.client;
        context.done = databaseCallbacks.done;
      })
      .then(resolve);
    }
    return resolve();
  })
  .then(new Promise(function (resolve, reject) {
    var query = 'INSERT INTO contact (imessage_id, full_name) VALUES ($1, $2) RETURNING imessage_id AS "id", full_name AS "name"';
    var queryParameters = [
      contact.getId(),
      contact.getName()
    ];
    context.client.query(query, queryParameters, function (error, result) {
      if (!error) {
        context.result = result.rows;
        if (context.result.length > 0) {
          newContact.setId(context.result[0].id);
          newContact.setName(context.result[0].name);
          return resolve();
        }
        error = new Error('Expected return rows empty');
      }
      return reject(error);
    });
  }))
  .then(new Promise(function (resolve, reject) {
    var query = 'INSERT INTO contact_handle (contact_imessage_id, handle) VALUES ($1, $2) RETURNING contact_imessage_id AS "id", handle AS "handle"';
    var queryParameters = [
      contact.getId(),
      contact.getHandle()
    ];
    context.client.query(query, queryParameters, function (error, result) {
      if (!error) {
        context.result = result.rows;
        if (context.result.length > 0) {
          newContact.setHandle(context.result[0].handle);
          if (newContact.getId() !== context.result[0].id) {
            logger.error('Contact table imessage_id mismatch: "%s" != "%s"', newContact.getId(), context.result[0].id);
            return reject(new Error('ID mismatch on create Contact'));
          }
          return resolve();
        }
        error = new Error('Expected return rows empty');
      }
      return reject(error);
    });
  }))
  .catch(function (error) {
    logger.error('Failure to create media', error);
  })
  .then(function () {
    context.done();
    context = null;
  })
  .then(Promise.resolve(newContact));
}
module.exports.createContact = createContact;

/**
 * Get a contact
 * @param {Contact} contact - The contact's handle
 * @return {Promise} callback - The callback function run on completion
 */
function getContact(contact) {
  var context = {};
  return new Promise(function (resolve, reject) {
    if (typeof client === 'undefined') {
      return databaseConnect()
      .catch(reject)
      .then(function (databaseCallbacks) {
        context.client = databaseCallbacks.client;
        context.done = databaseCallbacks.done;
      })
      .then(resolve);
    }
    return resolve();
  })
  .then(new Promise(function (resolve, reject) {
    var query = 'SELECT ' + contactColumnMapping + ' FROM contact ' +
      'JOIN contact_handle ON contact.imessage_id = contact_handle.contact_imessage_id ' +
    'WHERE contact.imessage_id = $1 AND contact_handle.handle = $2';
    var queryParameters = [
      contact.getId(),
      contact.handle()
    ];
    context.client.query(query, queryParameters, function (error, result) {
      if (!error) {
        context.result = result.rows;
        if (context.result.length > 0) {
          return resolve(context.result[0]);
        }
        error = new Error('Expected return rows empty');
      }
      return reject(error);
    });
  }))
  .catch(function (error) {
    logger.error('Failure to get contact', error);
  })
  .then(function () {
    context.done();
    context = null;
  });
}
module.exports.getContact = getContact;

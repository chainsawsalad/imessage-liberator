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
  .then(function (result) {
    if (result instanceof Error) {
      return Promise.reject(result);
    } else if (result === null) {
      return createContact(contact, context.client);
    }
    logger.debug('Contact already exists', contact);
    return result;
  })
  .catch(function (reason) {
    logger.error('Failure to save contact', reason);
    return reason;
  })
  .then(function (result) {
    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    logger.info('Save contact ended with result', result);
  });
}
module.exports.saveContact = saveContact;

/**
 * Create a new contact
 * @param {Contact} contact - The contact to create
 * @param {Client} client - The database client object
 * @return {Promise} callback - The callback function run on completion
 */
function createContact(contact, client) {
  var context = {
    client: client
  };
  return new Promise(function (resolve, reject) {
    if (typeof context.client === 'undefined') {
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
    return new Promise(function (resolve, reject) {
      var query = 'INSERT INTO contact (imessage_id, full_name) VALUES ($1, $2) RETURNING id, imessage_id AS "imessageId", full_name AS "name"';
      var queryParameters = [
        contact.getImessageId(),
        contact.getName()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        if (!error) {
          context.result = result.rows;
          if (context.result.length > 0) {
            return resolve(new Contact(context.result[0]));
          }
          error = new Error('Expected return rows empty');
        }
        return reject(error);
      });
    });
  })
  .then(function (newContact) {
    return new Promise(function (resolve, reject) {
      var query = 'INSERT INTO contact_handle (contact_id, handle) VALUES ($1, $2) RETURNING contact_id AS "id", handle AS "handle"';
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
            return resolve(newContact);
          }
          error = new Error('Expected return rows empty');
        }
        return reject(error);
      });
    });
  })
  .catch(function (reason) {
    logger.error('Failure to create contact', reason);
    return reason;
  })
  .then(function (result) {
    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    return result;
  });
}
module.exports.createContact = createContact;

/**
 * Get a contact
 * @param {Contact} contact - The contact's handle
 * @param {Client} client - The database client object
 * @return {Promise} callback - The callback function run on completion
 */
function getContact(contact, client) {
  var context = {
    client: client
  };
  return new Promise(function (resolve, reject) {
    if (typeof context.client === 'undefined') {
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
    return new Promise(function (resolve, reject) {
      var query = 'SELECT ' + contactColumnMapping + ' FROM contact ' +
        'JOIN contact_handle ON contact.id = contact_handle.contact_id ' +
      'WHERE contact.imessage_id = $1 AND contact_handle.handle = $2';
      var queryParameters = [
        contact.getImessageId(),
        contact.getHandle()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        if (!error) {
          context.result = result.rows;
          if (context.result.length > 0) {
            return resolve(new Contact(context.result[0]));
          }
          return resolve(null);
        }
        return reject(error);
      });
    });
  })
  .catch(function (reason) {
    logger.error('Failure to get contact', reason);
    return reason;
  })
  .then(function (result) {
    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    return result;
  });
}
module.exports.getContact = getContact;

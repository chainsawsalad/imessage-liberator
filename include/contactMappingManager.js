'use strict';

var path = require('path');
var logger = require('winston').loggers.get('logger');
var databaseConnect = require(path.join(__dirname, '/database.js'));
var Contact = require(path.join(__dirname, '/Contact.js'));

var contactColumnMapping = 'contact.imessage_id AS "imessageId", contact.full_name AS "name", contact_handle.handle';

module.exports.batchSaveContacts = function (contacts) {
  var batchOperations;
  var client;
  var done;

  return databaseConnect()
  .then(function (databaseCallbacks) {
    client = databaseCallbacks.client;
    done = databaseCallbacks.done;
    batchOperations = contacts.map(function (contact) {
      return createContact(contact, client);
    });
  })
  .then(function () {
    return new Promise(function (resolve, reject) {
      client.query('BEGIN', function (error) {
        if (error) {
          return reject(error);
        }
        return resolve();
      });
    });
  })
  // .then(function () {
  //   return new Promise(function (resolve, reject) {
  //     client.query('LOCK TABLE contact, contact_handle IN SHARE ROW EXCLUSIVE MODE', function (error) {
  //       if (error) {
  //         return reject(error);
  //       }
  //       return resolve();
  //     });
  //   });
  // })
  .then(function () {
    return Promise.all(batchOperations);
  })
  .then(function (result) {
    return new Promise(function (resolve, reject) {
      client.query('COMMIT', function (error) {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      });
    });
  })
  .catch(function (reason) {
    return new Promise(function (resolve, reject) {
      logger.error('Failure to iterate contacts', reason);
      client.query('ROLLBACK', function (error) {
        if (error) {
          return reject(error);
        }
        return resolve(reason);
      });
    });
  })
  .then(function (result) {
    done();
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
  });
};

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
    if (typeof client === 'undefined') {
      return new Promise(function (resolve, reject) {
        context.client.query('BEGIN', function (error, result) {
          if (error) {
            return reject(error);
          }
          resolve(result);
        });
      });
    }
    return Promise.resolve();
  })
  .then(function () {
    return new Promise(function (resolve, reject) {
      var query = 'INSERT INTO contact (imessage_id, full_name) VALUES ($1, $2) ' +
        'ON CONFLICT (imessage_id) DO UPDATE SET imessage_id = EXCLUDED.imessage_id ' +
        'RETURNING id, imessage_id AS "imessageId", full_name AS "name"';
      var queryParameters = [
        contact.getImessageId(),
        contact.getName()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        logger.debug('INSERTing', contact);
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
      var query = 'INSERT INTO contact_handle (contact_id, handle) VALUES ($1, $2) ' +
        'ON CONFLICT ON CONSTRAINT contact_id_handle_constraint DO UPDATE SET handle = EXCLUDED.handle ' +
        'RETURNING contact_id AS "id", handle AS "handle"';
      var queryParameters = [
        newContact.getId(), // NOTE: the id is coming from the `newContact`
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
  .then(function (result) {
    if (typeof client === 'undefined') {
      return new Promise(function (resolve, reject) {
        context.client.query('COMMIT', function (error) {
          if (error) {
            return reject(error);
          }
          return resolve(result);
        });
      });
    }
    return Promise.resolve(result);
  })
  .catch(function (reason) {
    if (typeof client === 'undefined') {
      return new Promise(function (resolve, reject) {
        logger.error('Failure to create contact', reason);
        context.client.query('ROLLBACK', function (error) {
          if (error) {
            return reject(error);
          }
          return resolve(reason);
        });
      });
    }
    return Promise.resolve(reason);
  })
  .then(function (result) {
    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;

    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
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
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
  });
}
module.exports.getContact = getContact;

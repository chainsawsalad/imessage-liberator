'use strict';

var path = require('path');
var logger = require('winston').loggers.get('logger');
var databaseConnect = require(path.join(__dirname, '/database.js'));
var Buddy = require(path.join(__dirname, '/Buddy.js'));
var Contact = require(path.join(__dirname, '/Contact.js'));
var ChannelMapping = require(path.join(__dirname, '/ChannelMapping.js'));

function queryWrapper(query, client) {
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
    return query()
    .catch(function (reason) {
      logger.error('Caught error in query wrapper', reason);
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

/**
 * Transactionalize a Promise.all series of generic database operations
 * @param {Function} operator - The function to which a memeber of `objectBatch` is passed in the Promise.all process loop
 * @param {Array} objectBatch - A list of objects to be iterated and passed to the `operator`
 * @return {Promise} Resolves with an array of what is returned by `operator` corresponding to each iteration of `objectBatch`
 */
module.exports.batchDatabaseOpperation = function (operator, objectBatch) {
  var batchOperations;
  var client;
  var done;

  return databaseConnect()
  .then(function (databaseCallbacks) {
    client = databaseCallbacks.client;
    done = databaseCallbacks.done;
    batchOperations = objectBatch.map(function (operationItem) {
      return operator(operationItem, client);
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
 * Create a Buddy if the Contact and Handle don't already exist
 * @param {Buddy} buddy - The buddy to create
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with the created Buddy
 */
module.exports.saveBuddy = function (buddy, client) {
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
        'ON CONFLICT (imessage_id) DO UPDATE SET full_name = EXCLUDED.full_name ' + // update the name in case it changed
        'RETURNING id, imessage_id AS "imessageId", full_name AS "name"';
      var queryParameters = [
        buddy.getContact().getImessageId(),
        buddy.getContact().getName()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        logger.debug('INSERTing', buddy.toJson());
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
        buddy.getHandle()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        if (!error) {
          context.result = result.rows;
          if (context.result.length > 0) {
            if (newContact.getId() !== context.result[0].id) {
              logger.error('Contact table imessage_id mismatch: "%s" != "%s"', newContact.getId(), context.result[0].id);
              return reject(new Error('ID mismatch on create Contact'));
            }
            return resolve(new Buddy({
              contact: newContact,
              handle: context.result[0].handle
            }));
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
};

/**
 * Get contact and channel mapping
 * @param {String} imesssageId - The imesssageId of the contact whose mapping to get
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with a Contact and ChannelMapping
 */
module.exports.getContactChannelMappingByImessageId = function (imesssageId, messageChannel, client) {
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
    return getContactByImessageId(imesssageId, context.client)
    .then(function (contact) {
      context.contact = contact;
      return new Promise(function (resolve, reject) {
        var query = 'SELECT id, message_channel_id AS "messageChannel", channel_key AS "channelKey", ' +
          'channel_name AS "channelName" FROM contact_channel_mapping ' +
        'WHERE contact_id = $1 AND message_channel_id = $2';
        var queryParameters = [
          context.contact.getId(),
          messageChannel
        ];
        context.client.query(query, queryParameters, function (error, result) {
          if (!error) {
            context.result = result.rows;
            if (context.result.length === 1) {
              return resolve(new ChannelMapping(context.result[0]));
            } else if (context.result.length === 0) {
              return resolve(null);
            }
            error = new Error('Unexpected return rows count');
          }
          return reject(error);
        });
      })
      .then(function (channelMapping) {
        context.channelMapping = channelMapping;
      });
    });
  })
  .catch(function (reason) {
    logger.error('Failure to get contact and/or channel mapping', reason);
    return Promise.reject(reason);
  })
  .then(function (result) {
    var payload = {
      contact: context.contact,
      channelMapping: context.channelMapping
    };
    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(payload);
  });
};

/**
 * Get a contact by imessage id
 * @param {String} imesssageId - The imesssageId of the contact whose mapping to get
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with a Contact
 */
function getContactByImessageId(imessageId, client) {
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
      var query = 'SELECT id, imessage_id AS "imessageId", full_name AS "name" FROM contact WHERE imessage_id = $1';
      var queryParameters = [
        imessageId
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

/**
 * Get all contacts
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with a Contact[]
 */
module.exports.getAllContacts = function (client) {
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
      var query = 'SELECT contact.id, contact.imessage_id AS "imessageId", contact.full_name AS "name" FROM contact';
      context.client.query(query, function (error, result) {
        if (!error) {
          context.result = (result.rows || []).map(function (result) {
            return new Contact(result);
          });
          return resolve(context.result);
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
};

/**
 * Get all channel mappings organized by contact. Handles are not considered.
 * @param {Enum} messageChannel - The message channel whose mappings will be retrieved
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with a ChannelMapping[]
 */
module.exports.getAllChannelMappingsByContact = function (messageChannel, client) {
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
      var query = 'SELECT ccm.id AS "channelMappingId", ccm.message_channel_id AS "messageChannel", ccm.contact_id AS "contactId", ' +
          'ccm.channel_key AS "channelKey", ccm.channel_name AS "channelName", contact.imessage_id AS "contactImessageId", ' +
          'contact.full_name AS "contactName" FROM contact ' +
        'JOIN contact_channel_mapping AS ccm ON contact.id = ccm.contact_id';
      context.client.query(query, function (error, result) {
        var channelMapping = null;

        if (!error) {
          context.result = (result.rows || []).map(function (result) {
            if (result.channelMappingId) {
              channelMapping = new ChannelMapping({
                id: result.channelMappingId,
                messageChannel: result.messageChannel,
                contactId: result.contactId,
                channelKey: result.channelKey,
                channelName: result.channelName
              });
            }
            return {
              contact: new Contact({
                id: result.contactId,
                imessageId: result.contactImessageId,
                name: result.contactName
              }),
              channelMapping: channelMapping
            };
          });
          return resolve(context.result);
        }
        return reject(error);
      });
    });
  })
  .catch(function (reason) {
    logger.error('Failure to get channel mappings', reason);
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
};

/**
 * Get all channel mappings organized by handle
 * @param {Enum} messageChannel - The message channel whose mappings will be retrieved
 * @param {Client} client - The database client object
 * @return {Promise} Resolves with a ChannelMapping[]
 */
module.exports.getAllChannelMappingsByHandle = function (messageChannel, client) {
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
      var query = 'SELECT ccm.id AS "channelMappingId", ccm.message_channel_id AS "messageChannel", ccm.contact_id AS "contactId", ' +
          'ccm.channel_key AS "channelKey", ccm.channel_name AS "channelName", contact.imessage_id AS "imessageId", ' +
          'contact.full_name AS "contactName", contact_handle.handle AS "buddyHandle" FROM contact_handle ' +
        'JOIN contact ON contact.id = contact_handle.contact_id ' +
        'JOIN contact_channel_mapping AS ccm ON contact_handle.contact_id = ccm.contact_id';
      context.client.query(query, function (error, result) {
        if (!error) {
          context.result = (result.rows || []).map(function (result) {
            return {
              buddy: new Buddy({
                contact: new Contact({
                  id: result.contactId,
                  imessageId: result.contactImessageId,
                  name: result.contactName
                }),
                handle: result.buddyHandle
              }),
              channelMapping: new ChannelMapping({
                id: result.channelMappingId,
                messageChannel: result.messageChannel,
                contactId: result.contactId,
                channelKey: result.channelKey,
                channelName: result.channelName
              })
            };
          });
          return resolve(context.result);
        }
        return reject(error);
      });
    });
  })
  .catch(function (reason) {
    logger.error('Failure to get channel mappings', reason);
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
};

/**
 * Create a ChannelMapping if it doesn't already exist, otherwise update the channel key and name
 * @param {ChannelMapping} channelMapping - The channelMapping object to save
 * @return {Promise} Resolves with a ChannelMapping
 */
module.exports.saveChannelMapping = function (channelMapping, client) {
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
      var query = 'INSERT INTO contact_channel_mapping (message_channel_id, contact_id, channel_key, channel_name) VALUES ($1, $2, $3, $4) ' +
        'ON CONFLICT ON CONSTRAINT contact_id_message_channel_id_constraint DO UPDATE SET channel_key = $3, channel_name = $4 ' +
        'RETURNING id, message_channel_id AS "messageChannel", contact_id AS "contactId", channel_key AS "channelKey", channel_name AS "channelName"';
      var queryParameters = [
        ChannelMapping.MessageChannel[channelMapping.getMessageChannel()],
        channelMapping.getContactId(),
        channelMapping.getChannelKey(),
        channelMapping.getChannelName()
      ];
      context.client.query(query, queryParameters, function (error, result) {
        logger.debug('INSERTing', channelMapping);
        if (!error) {
          context.result = result.rows;
          if (context.result.length > 0) {
            return resolve(new ChannelMapping(context.result[0]));
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
};

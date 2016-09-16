'use strict';

var path = require('path');
var logger = require('winston').loggers.get('logger');
var databaseConnect = require(path.join(__dirname, '/database.js'));

var contactColumnMapping = 'contact.id AS uid, contact.full_name AS "name", contact.handle';

/**
 * Create a new contact
 * @param {String} name - The name of the contact
 * @param {String} handle - The contact's handle
 * @param {Function} callback - The callback function run on completion
 */
module.exports.createContact = function createContact(name, handle) {
  var context = {};
  return databaseConnect()
    .then(function (databaseCallbacks) {
      context.client = databaseCallbacks.client;
      context.done = databaseCallbacks.done;
    })
    .then(new Promise(function (resolve, reject) {
      var query = 'INSERT INTO contact (full_name, handle) VALUES ($1, $2) RETURNING ' + contactColumnMapping;
      var queryParameters = [
        name,
        handle
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
      logger.error('Failure to create media', error);
    })
    .then(function () {
      context.done();
      context = null;
    });
};

module.exports.getMediaById = function getMediaById(mediaId, callback, client) {
  var context = {};

  async.series([
    function getMediaConnect(next) {
      if (client) {
        context.client = client;
        next();
        return;
      }

      databaseConnect(function (error, client, done) {
        context.client = client;
        context.done = done;
        next(error);
      });
    },
    function getMediaQuery(next) {
      var query = 'SELECT ' + mediaColumnMapping + ' FROM media WHERE id = $1';

      context.client.query(query, [mediaId], function (error, result) {
        if (!error) {
          context.result = result.rows[0];
        }
        next(error);
      });
    }
  ], function (error, result) {
    var media = null;

    if (error) {
      logger.error('Failure fetching media by id', error);
    } else if (context.result) {
      media = new Media(context.result);
    }

    if (typeof context.done === 'function') {
      context.done();
    }

    context = null;
    callback(error, media);
  });
};

module.exports.deleteMediaById = function deleteMediaById(mediaId, callback, client) {
  var context = {};

  async.series([
    function getMediaConnect(next) {
      if (client) {
        context.client = client;
        next();
        return;
      }

      databaseConnect(function (error, client, done) {
        context.client = client;
        context.done = done;
        next(error);
      });
    },
    function getMediaQuery(next) {
      var query = 'DELETE FROM media WHERE id = $1';

      context.client.query(query, [mediaId], function (error, result) {
        next(error);
      });
    }
  ], function (error, result) {
    if (error) {
      logger.error('Failure deleting media by id', error);
    }

    if (typeof context.done === 'function') {
      context.done();
    }

    context = null;
    callback(error);
  });
};

module.exports.getAllMediaByBrandId = function getAllMediaByBrandId(brandId, callback, client) {
  var context = {};

  async.series([
    function getMediaConnect(next) {
      if (client) {
        context.client = client;
        next();
        return;
      }

      databaseConnect(function (error, client, done) {
        context.client = client;
        context.done = done;
        next(error);
      });
    },
    function getMediaQuery(next) {
      var query = 'SELECT ' + mediaColumnMapping + ' FROM media WHERE brand_id = $1 ORDER BY name';

      context.client.query(query, [brandId], function (error, result) {
        if (!error) {
          context.result = result.rows;
        }
        next(error);
      });
    }
  ], function (error, result) {
    var mediaFiles = [];

    if (error) {
      logger.error('Failure fetching media by brand id', error);
    } else {
      context.result.forEach(function (media) {
        mediaFiles.push(new Media(media));
      });
    }

    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    callback(error, mediaFiles);
  });
};

module.exports.getAllMediaByBrandKey = function getAllMediaByBrandKey(brandKey, callback, client) {
  var context = {};

  async.series([
    function getMediaConnect(next) {
      if (client) {
        context.client = client;
        next();
        return;
      }

      databaseConnect(function (error, client, done) {
        context.client = client;
        context.done = done;
        next(error);
      });
    },
    function getMediaQuery(next) {
      var query = 'SELECT ' + mediaColumnMapping + ' FROM media WHERE brand_id = $1 ORDER BY name';

      context.client.query(query, [brandKey], function (error, result) {
        if (!error) {
          context.result = result.rows;
        }
        next(error);
      });
    }
  ], function (error, result) {
    var mediaFiles = [];

    if (error) {
      logger.error('Failure fetching media by brand id', error);
    } else {
      context.result.forEach(function (media) {
        mediaFiles.push(new Media(media));
      });
    }

    if (typeof context.done === 'function') {
      context.done();
    }
    context = null;
    callback(error, mediaFiles);
  });
};

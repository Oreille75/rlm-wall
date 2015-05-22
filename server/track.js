var _ = require('underscore'),
    Q = require('q'),
    config = require('./config'),
    models = require('./models'),
    logger = require('./logger'),
    twStream = require('node-tweet-stream'),
    ig = require('instagram-node').instagram(),
    tws;

var app, io;

var ig_fetching = false,
    ig_handler,
    ig_fetch;

// var https = require('https'), utils = require('util');
// https.__request = https.request;
// https.request = function() {
//   var request = https.__request.apply(https, arguments);
//   logger.verbose('HTTPS', utils.inspect(arguments));
//   return request;
// };

tws = new twStream(config.twitter);
ig.use(config.instagram);

function add_message(type, data) {
  var moderate = app.locals.globals.moderate;
  var user = null;
  var md = {
    type: type,
    message_id: null,
    zoom: false,
    winner: false,
    validated: (moderate ? false : true),
    data: data
  };
  if (type === 'twitter') {
    md.message_id = data.id_str;
    user = data.user.screen_name;
  }
  else if (type === 'instagram') {
    md.message_id = data.id;
    user = data.user.username;
  }
 
  if (app.locals.globals.blocked !== null) {
    if (_.contains(app.locals.globals.blocked.split(/\s+/), user)) {
      logger.verbose('user blocked: ' + user);
      return;
    }
  }

  var message = new models.Message(md);
  message.save();

  var cmessage = message.client_message();
  
  logger.verbose('message' + (moderate ? '[*]' : '') + ': ' +
                 cmessage.type + ' ' + 
                 cmessage.user);

  io.sockets.in(moderate ? 'admin' : 'client').emit('message', cmessage);
}

function start_twitter() {
  tws.track('#' + app.locals.globals.tag);
}

function start_instagram() {
  app.locals.globals.ig_min_tag_id = null;
  ig.add_tag_subscription(
    app.locals.globals.tag,
    config.base_url + '/instagram-feed/',
    {},
    function(err, result, limit) {
      if (err) {
        logger.error('track.start_instagram');
        logger.verbose(err.toString());
        return;
      }
      app.locals.globals.ig_subscription_id = result.id;
      app.locals.globals.save();
      logger.verbose('instagram subscription: ' + 
                     app.locals.globals.ig_subscription_id);
    }
  );
}

function stop_twitter() {
  tws.untrack('#' + app.locals.globals.tag);
}

function stop_instagram() {
  ig.del_subscription({
    all: true
  }, function(err, subscriptions, remaining, limit) {
    if (err) {
      logger.error('track.stop_instagram');
      return;
    }
  });
}

function start() {
  logger.info('start tracking #' + app.locals.globals.tag);
  if (app.locals.globals.track_twitter) {
    start_twitter();
  }
  if (app.locals.globals.track_instagram) {
    start_instagram();
  }
}

function stop() {
  logger.warn('stop tracking #' + app.locals.globals.tag);
  if (app.locals.globals.track_twitter) {
    stop_twitter();
  }
  if (app.locals.globals.track_instagram) {
    stop_instagram();
  }
}

function init() {

  logger.info('init tracking #' + app.locals.globals.tag);
  if (app.locals.globals.track_twitter) {
    if (app.locals.globals.running) {
      start_twitter();
    }
    else {
      stop_twitter();
    }
  }
  if (app.locals.globals.track_instagram) {
    app.locals.globals.ig_min_tag_id = null;
    ig.subscriptions(function(err, subscriptions, remaining, limit) {
      if (err) {
        logger.error('track.init');
        return;
      }
      if (subscriptions.length) {
        app.locals.globals.ig_subscription_id = subscriptions[0].id;
        logger.verbose('instagram subscription: ' + 
                       app.locals.globals.ig_subscription_id);
      }
      else {
        app.locals.globals.ig_subscription_id = null;
      }
      if (app.locals.globals.running && 
          app.locals.globals.ig_subscription_id === null) {
        logger.warn('running but no instagram subscription');
        start_instagram();
      }
      if (!app.locals.globals.running && 
          app.locals.globals.ig_subscription_id !== null) {
        logger.warn('not running but subscribed to instagram');
        stop_instagram();
      }
    });
  }
}

ig_handler = function(err, medias, pagination, remaining, limit) {
  if (err) {
    logger.error('track.ig_handler');
    return;
  }
  medias.forEach(function(media, index) {
    add_message('instagram', media);
  });

  ig_fetching = false;

  if (pagination.min_tag_id && 
      pagination.min_tag_id > app.locals.globals.ig_min_tag_id) {
    app.locals.globals.ig_min_tag_id = pagination.min_tag_id;
    app.locals.globals.save();
    ig_fetch();
  }
};

ig_fetch = function() {
  if (ig_fetching) {
    return;
  }
  ig_fetching = true;
  setTimeout(function() {
    ig.tag_media_recent(app.locals.globals.tag, {
      min_tag_id: app.locals.globals.ig_min_tag_id
    }, ig_handler);
  }, 1000);
};

function Track(_app, _io) {
  app = _app;
  io = _io;

  app.get('/oauth', function(req, res) {
    res.json({ success: true });
  });

  app.get('/instagram-feed/', function (req, res) {
    if (req.query.hasOwnProperty('hub.challenge')) {
      logger.verbose('instagram: hub challenge');
      res.send(req.query['hub.challenge']);
    } else {
      logger.error('instagram: hub challenge error');
      res.sendStatus(404);
    }
  });

  app.post('/instagram-feed/', function (req, res) {
    if (!Array.isArray(req.body) ||
        !req.body.length ||
        !req.body[0].hasOwnProperty('subscription_id') ||
        req.body[0].subscription_id !== app.locals.globals.ig_subscription_id) {
      logger.verbose('instagram: callback post -- bad data');
      res.sendStatus(404);
      return;
    }
  
    if (!app.locals.globals.running) {
      logger.verbose('instagram: callback post -- not running');
      res.sendStatus(404);
      return;
    }
    
    res.json({ success: true });
    ig_fetch(app.locals.globals.tag);
  });

  var get_messages = function(req, res, find) {
    if (req.query.before_date) {
      find.date = { $lt: new Date(req.query.older) };
    }
    if (req.query.before_id) {
      find._id = { $lt: req.query.before_id };
    }
    models.Message
      .find(find)
      .sort({ date: -1 })
      .limit(20)
      .exec(function(err, data) {
        res.json(_.map(data, function(m) {
          return m.client_message();
        }));
      });
  };

  var loggedIn = function(req, res, next) {
    if (req.user) {
      next();
    }
    else {
      res.sendStatus(403);
    }
  };

  app.get('/api/messages', function(req, res) {
    get_messages(req, res, { validated: true });
  });

  app.patch('/api/admin-messages/:id', loggedIn, function(req, res) {
    models.Message.findOne({_id: req.params.id}, function(err, message) {
      var old_validated, k;
      if (err) {
        res.send(err);
        return;
      }
      old_validated = message.validated;
      for (k in req.body) {
        message[k] = req.body[k];
      }
      message.save(function(err) {
        var cmessage;
        if (err) {
          res.send(err);
          return;
        }
        res.json(message);
        cmessage = message.client_message();
        io.sockets
          .in(message.validated ? 'client' : 'admin')
          .emit('message', message.client_message());
        if (old_validated && !message.validated) {
          io.sockets.in('client').emit('remove-message', message._id);
        }
      });
    });
  });

  app.get('/api/admin-messages', loggedIn, function(req, res) {
    get_messages(req, res, { validated: false });
  });

  app.get('/api/stats', loggedIn, function(req, res) {
    models.Message.aggregate([
      { $match: { $or: [ 
        { discarded: true }, 
        { validated: true } 
      ] } },
      { $sort: { date: -1 } },
      { $limit: 2000 },
      {
        $project: {
          _id: 1,
          date: 1,
          twitter: { 
            $cond: [ {
              $and: [ 
                { $eq: ['$discarded', false] },
                { $eq: ['$type', 'twitter'] } 
              ]
            }, 1, 0 ] 
          },
          instagram: { 
            $cond: [ { 
              $and: [
                { $eq: ['$discarded', false] },
                { $eq: ['$type', 'instagram'] }
              ]
            }, 1, 0 ] 
          },
          discarded: { 
            $cond: [ { 
              $eq: ['$discarded', true] 
            }, 1, 0 ]
          }
        }
      },
      {
        $group: {
          _id: {
            y: { $year: '$date' },
            d: { $dayOfYear: '$date' },
            h: { $hour: '$date' }
            // m: { $minute: '$date' }
          },
          total: { $sum: 1 },
          twitter: { $sum: '$twitter' },
          instagram: { $sum: '$instagram' },
          discarded: { $sum: '$discarded' },
          min_id: { $min: '$_id' },
          max_id: { $max: '$_id' },
          min_date: { $min: '$date' },
          max_date: { $max: '$date' }
        }
      },
      { $sort: { min_date: 1 } }
    ], function(err, data) {
      if (err) {
        res.send(err);
        return;
      }
      if (data.length > 1) {
        data.shift();
      }
      res.json(data);
    });
  });

  app.post('/api/go', loggedIn, function(req, res) {
    var find = null,
        limit = null;
    if (req.body.date) {
      find = { validated: true, date: { $gt: new Date(req.body.date) }};
      limit = 2000;
    }
    else if (req.body.last) {
      find = { validated: true };
      limit = 6;
    }
    if (!find) {
      res.sendStatus(404);
      return;
    }
    models.Message
      .find(find)
      .sort({ date: -1 })
      .limit(limit) 
      .exec(function(err, data) {
        var client_data = _.map(data, function(m) {
          return m.client_message(); 
        });
        io.sockets.in('client').emit('messages', _.map(data, function(m) {
          return m.client_message();
        }));
        res.json({ go: 'OK', count: data.length });
      });
  });

  app.get('/api/globals', function(req, res) {
    res.json(app.locals.globals);
  });
  
  app.patch('/api/globals', loggedIn, function(req, res) {
    var k, 
        modified = false, 
        old_globals = _.clone(app.locals.globals.toJSON());

    for (k in req.body) {
      if (models.Globals.schema.paths.hasOwnProperty(k)) {
        if (String(app.locals.globals[k]) !== req.body[k]) {
          modified = true;
          app.locals.globals[k] = req.body[k];
          logger.info('config ' + k + ' = "' + req.body[k] + '"');
        }
      }
    }
    if (modified) {
      app.locals.globals.save(function(err) {
        if (err) {
          res.send(err);
          return;
        }
        res.json(app.locals.globals);

        if (old_globals.tag !== app.locals.globals.tag) {
          if (old_globals.running) {
            stop();
            old_globals.running = 0;
          }
        }
        if (old_globals.running && !app.locals.globals.running) {
          stop();
        }
        if (!old_globals.running && app.locals.globals.running) {
          start();
        }
        io.sockets.emit('globals', app.locals.globals);
      });
    }
    else {
      res.json(app.locals.globals);
    }
  });
  
  tws.on('tweet', function(tweet) {
    add_message('twitter', tweet);
  });

  tws.on('error', function(err) {
    logger.error('twitter stream');
  });

}

Track.prototype.initial_state = function() {
  var deferred = Q.defer();
  Q.all([
    new Q(models.Message
          .find({ validated: true })
          .sort({ date: -1 })
          .limit(8)
          .exec()),
    new Q(models.Message
          .find({ validated: true, special: { $in: ['zoom', 'win'] }})
          .sort({ date: -1 })
          .limit(1)
          .exec())
  ]).spread(function(last_messages, last_zooms) {
    var init_state = {
      last_messages: _.map(last_messages,
                           function(m) { return m.client_message(); }),
      last_zooms: _.map(last_zooms,
                        function(m) { return m.client_message(); })
    };
    deferred.resolve(init_state);
  }).done();
  return deferred.promise;
};

Track.prototype.init = function() {
  init();
};

module.exports = Track;

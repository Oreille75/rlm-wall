var _          = require('underscore'),
    Q          = require('q'),
    Twitter    = require('twitter'),
    instagram  = require('instagram-node'),
    request    = require('request'),
    config     = require('./config'),
    logger     = require('./logger');

function Followers(app, io) {
  this.app = app;
  this.io = io;

  this.interval = 30 * 1000;

  this.tw = new Twitter({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token_key: config.twitter.token,
    access_token_secret: config.twitter.token_secret
  });

  this.ig = instagram.instagram();
  this.ig.use(config.instagram);
}

Followers.prototype.start = function() {
  logger.info('start counting followers...');
  this.run();
  this._interval = setInterval(_.bind(this.run, this), this.interval);
};

Followers.prototype.run = function() {
  this.count().then(_.bind(function(count) {
    if (!_.isEqual(this.app.locals.globals.followers, count)) {
      logger.debug('followers', count);
      this.app.locals.globals.followers = count;
      this.app.locals.globals.save();
      this.io.sockets.in('client').emit('followers', count);
    }
  }, this));
};

Followers.prototype.count = function() {
  var deferred = Q.defer();
  Q.allSettled([
    this.twitter_count(),
    this.facebook_count(),
    this.instagram_count()
  ]).then(function(results) {
    var counts = {
      twitter: null,
      facebook: null,
      instagram: null
    };
    if (results[0].state === 'fulfilled') {
      counts.twitter = results[0].value;
    }
    if (results[1].state === 'fulfilled') {
      counts.facebook = results[1].value;
    }
    if (results[2].state === 'fulfilled') {
      counts.instagram = results[2].value;
    }
    deferred.resolve(counts);
  }).done();
  return deferred.promise;
};

Followers.prototype.twitter_count = function() {
  var deferred = Q.defer();
  this.tw.get('users/show', {
    screen_name: config.names.twitter
  }, function(error, userinfo, response) {
    if (error) {
      logger.error(error);
      deferred.reject();
      return;
    }
    deferred.resolve(userinfo.followers_count);
  });
  return deferred.promise;
};

Followers.prototype.facebook_count = function() {
  var deferred = Q.defer();
  request({
    url: 'http://graph.facebook.com/' + config.names.facebook
  }, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var data;
      try {
        data = JSON.parse(body);
        deferred.resolve(data.likes);
      }
      catch (e) {
        deferred.reject();
      }
      return;
    }
    deferred.reject();
  });
  return deferred.promise;
};

Followers.prototype.instagram_count = function() {
  var deferred = Q.defer();

  this.ig.user(
    config.names._instagram_id, 
    function(error, data, remaining, limit) {
      if (!error && data.counts) {
        deferred.resolve(data.counts.followed_by);
        return;
      }
      deferred.reject();
    }
  );
  return deferred.promise;
};

module.exports = Followers;

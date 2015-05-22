var _ = require('underscore'),
    Q = require('q'),
    express = require('express'),
    http = require('http'),
    socketIo = require('socket.io'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    mongoose = require('mongoose'),
    MongoStore = require('connect-mongo')(session),

    config = require('./server/config'),
    models = require('./server/models'),
    logger = require('./server/logger'),

    app = express(),
    server = http.Server(app),
    io = socketIo(server),

    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;

app.set('json spaces', 2);

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: '2A75irFJxXgQFCFWlia7s95RKU51Yg11MHHFzBz16gE=',
  cookie: {
    maxAge: 3 * 24 * 60 * 60 * 1000
  },
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));
app.use(passport.initialize());
app.use(passport.session());

/*
app.use(function(req, res, next) {
  logger.debug('%s %s', req.method, req.url);
  next();
});
*/

var localUsers = {
  'rlm': { id: '1', username: 'rlm', password: 'RLMTeam' }
};

passport.use('local', new LocalStrategy(
  function(username, password, done) {
    if (!localUsers.hasOwnProperty(username)) {
      return done(null, false, { message: 'Utilisateur incorrect.' });
    }
    if (password !== localUsers[username].password) {
      return done(null, false, { message: 'Mot de passe incorrect.' });
    }
    return done(null, localUsers[username]);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  if (id === '1') {
    done(null, localUsers.rlm);
    return;
  }
  done(null, false);
});

app.post('/admin/login', passport.authenticate('local', {
  successRedirect: '/admin',
  failureRedirect: '/admin/login'
}));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/admin/login', function(req, res) {
  res.sendFile(__dirname + '/public/login.html');
});

function loggedInRedirect(req, res, next) {
  if (req.user) {
    next();
  }
  else {
    res.redirect('/admin/login');
  }
}

app.get('/admin', loggedInRedirect, function(req, res) {
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/admin/*', loggedInRedirect, function(req, res) {
  res.sendFile(__dirname + '/public/admin.html');
});

var start_server = function() {
  var deferred = Q.defer();
  server.listen(app.get('port'), function() {
    logger.info('Server running at %s', config.base_url);
    logger.info('port=%s env=%s', app.get('port'), app.get('env'));
    deferred.resolve();
  });
  return deferred.promise;
};

var connect_db = function() {
  var deferred = Q.defer();
  mongoose.connection.on('open', function() {
    logger.info('Connected to ' + config.mongodb);
    var on_connected = function() {
      if (/localhost/.test(config.base_url)) {
        logger.debug('instagram forced off');
        app.locals.globals.track_instagram = 0;
        app.locals.globals.save();
      }
      deferred.resolve();
    };
    models.Globals.findOne({}, function(err, data) {
      if (data === null) {
        logger.debug('Initializing global variables...');
        app.locals.globals = new models.Globals({});
        app.locals.globals.save(function(err) {
          on_connected();
        });
      }
      else {
        app.locals.globals = data;
        on_connected();
      }
    });
  });
  mongoose.connect(config.mongodb);
  return deferred.promise;
};

var Track = require('./server/track');
var Followers = require('./server/followers');
var Reloadify = require('./server/reloadify');

Q.all([connect_db(), start_server()]).then(function() {

  var reloadify = new Reloadify(app, io, __dirname + '/public/');
  var track = new Track(app, io);
  var followers = new Followers(app, io);

  io.sockets.on('connection', function(socket) {

    socket.on('client-handshake', function(data) {
      logger.info('client connected');
      track.initial_state().then(function(initial_state) {
        socket.emit('globals', app.locals.globals);
        socket.emit('messages', initial_state.last_messages);
        socket.emit('last-zooms', initial_state.last_zooms);
        socket.join('client');
      }).done();
    });

    socket.on('admin-handshake', function(data) {
      logger.info('admin connected');
      socket.emit('globals', app.locals.globals);
      socket.join('admin');
      socket.join('client');
    });
    
    socket.on('disconnect', function() {
      logger.info('socket disconnected');
    });

  });

  track.init();
  followers.start();

});

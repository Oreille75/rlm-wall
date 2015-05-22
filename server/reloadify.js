var _     = require('underscore'),
    watch = require('watch'),
    path  = require('path'),
    logger = require('./logger');

function reloadify(app, io, dir) {
  var sendReload = _.debounce(function() {
    logger.verbose('[client reload]');
    io.sockets.emit('reload');
  }, 100);
  if (app.get('env') !== 'home') {
    return;
  }
  watch.watchTree(dir, function(f, curr, prev) {
    if (typeof f === "string") {
      var b = path.basename(f);
      if (b[0] === '.' || b[0] === '#') {
        return;
      }
      logger.debug('modified: '+b);
      sendReload();
    }
  });
}

module.exports = reloadify;

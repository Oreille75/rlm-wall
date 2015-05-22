var winston = require('winston'),
    colors = require('colors'),
    dateFormat = require('dateformat');

// levels: debug - verbose - info - warn - error

colors.setTheme({
  silly: 'rainbow',
  verbose: 'cyan',
  info: 'green',
  data: 'grey',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

var logdir = __dirname + '/../log',
    exitOnError = false,
    transports;

function formatter(options) {
  var d = new Date(),
      date = dateFormat(d, 'yyyy-mm-dd HH:MM:ss'),
      level = colors[options.level](options.level.toUpperCase());
  return ('['+ date.data + '] ' + level + ' ' +
          (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ?
           '\n'+ JSON.stringify(options.meta, null, '  ').data : ''));
}

if (process.env.NODE_ENV === 'home') {
  transports = [
    new (winston.transports.Console)({ 
      name: 'console',
      level: 'debug',
      formatter: formatter,
      handleExceptions: true
    })
  ];
}
else {
  transports = [
    new (winston.transports.DailyRotateFile)({
      name: 'verbose-file',
      filename: logdir + '/verbose.log',
      level: 'verbose',
      handleExceptions: true
    }),
    new (winston.transports.DailyRotateFile)({
      name: 'info-file',
      filename: logdir + '/info.log',
      level: 'info',
      handleExceptions: true
    }),
    new (winston.transports.DailyRotateFile)({
      name: 'error-file',
      filename: logdir + '/error.log',
      level: 'error',
      handleExceptions: true
    })
  ];
}

var logger = new (winston.Logger)({
  exitOnError: exitOnError,
  transports: transports
});

module.exports = logger;

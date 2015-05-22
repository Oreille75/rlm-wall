var _ = require('underscore'),
    colors = require('colors'),
    dateFormat = require('dateformat'),
    readline = require('readline');

colors.setTheme({
  silly: 'rainbow',
  verbose: 'cyan',
  info: 'green',
  data: 'grey',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

function formatter(options) {
  var d = new Date(options.timestamp),
      date = dateFormat(d, 'yyyy-mm-dd HH:MM:ss'),
      level = colors[options.level](options.level.toUpperCase());
  return ('['+ date.data + '] ' + level + ' ' +
          (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ?
           '\n'+ JSON.stringify(options.meta, null, '  ').data : ''));
}

var r = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

r.on('line', function(line) {
  try {
    var o = JSON.parse(line);
    console.log(formatter(o));
  }
  catch(e) {
    console.log(e);
    console.log('** malformatted log: ' + line);
  }
});

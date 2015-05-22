var _ = require('lodash');
var crypto = require('crypto');
var fs = require('fs');

var gulp = require('gulp');
var gutil = require('gulp-util');
var less = require('gulp-less');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var nodemon = require('gulp-nodemon');
var jshint = require('gulp-jshint');
var replace = require('gulp-replace');
var streamify = require('gulp-streamify');
var runSequence = require('run-sequence');
var transform = require('vinyl-transform');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var LessPluginCleanCSS = require('less-plugin-clean-css');
var LessPluginAutoPrefix = require('less-plugin-autoprefix');
var cleancss = new LessPluginCleanCSS({ advanced: true });
var autoprefix = new LessPluginAutoPrefix({ browsers: ["last 2 versions"] });

gulp.task('less', function() {
  return gulp.src('./client/less/*.less')
    .pipe(less({ plugins: [autoprefix, cleancss] }))
    .pipe(gulp.dest('./public/css'));
});

gulp.task('client-libs', ['client-libs-common']);

gulp.task('client-libs-common', function() {
  return browserify()
    .require('underscore')
    .require('jquery')
    .require('backbone')
    .require('backbone.marionette')
    .require('socket.io-client')
    .bundle()
    .pipe(source('rlm-wall-libs.js'))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest('./public/js'));
});

gulp.task('client-scripts', function() {
  var browserified = transform(function(filename) {
    return browserify(filename)
      .external('jquery')
      .external('backbone')
      .external('underscore')
      .external('backbone.marionette')
      .external('socket.io-client')
      .external('d3')
      .external('nvd3')
      .bundle();
  });
  return gulp.src(['./client/rlm-wall.js',
                   './client/rlm-wall-admin.js'])
    .pipe(browserified)
    .pipe(streamify(uglify()))
    .pipe(gulp.dest('./public/js'));
});

gulp.task('htmlversion', function() {
  var stream = gulp.src(['public/index.html', 
                         'public/admin.html',
                         'public/login.html']);

  var handles = {
    'public/css/rlm-wall-admin.css': 'rlm-wall-admin.css?version=',
    'public/css/rlm-wall.css': 'rlm-wall.css?version=',
    'public/js/rlm-wall-libs.js': 'rlm-wall-libs.js?version=',
    'public/js/rlm-wall-admin.js': 'rlm-wall-admin.js?version=',
    'public/js/rlm-wall.js': 'rlm-wall.js?version='
  };

  var md5 = function(filepath) {
    var hash = crypto.createHash('md5'), digest;
    hash.update(fs.readFileSync(filepath));
    digest = hash.digest('hex');
    gutil.log(filepath + ': ' + digest);
    return digest;
  };

  var escRe = function(string) {
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  _.forEach(handles, function(handle, f) {
    var hash = md5(f);
    var re = new RegExp('(' + escRe(handle) + ')([^"]+)', 'g');
    stream.pipe(replace(re, '$1' + hash));
  });

  return stream.pipe(gulp.dest('public'));
});

gulp.task('build', function(callback) {
  runSequence(['less',
               'client-libs', 
               'client-scripts'],
              'htmlversion',
              callback);
});

gulp.task('watch', ['build'], function() {
  gulp.watch(['./client/less/*.less'], function() {
    runSequence('less', 'htmlversion');
  });
  gulp.watch(['./client/*.js', './client/templates/*'], function() {
    runSequence('client-scripts', 'htmlversion');
  });
});

gulp.task('dev', ['build', 'watch'], function() {
  nodemon({
    script: 'server.js',
    ext: 'js html css',
    ignore: [
      'node_modules/**',
      'public/**',
      'client/**',
      'build/**',
    ],
    env: {
      NODE_ENV: 'home',
      PORT: 8080
    }
  });
});

gulp.task('default', function() {
  return gulp.start('dev');
});

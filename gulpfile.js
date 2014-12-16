var gulp = require('gulp'),
    rename = require('gulp-rename'),
    browserify = require('gulp-browserify'),
    less = require('gulp-less'),
    Q = require('q'),
    http = require('http'),
    express = require('express'),
    proxy = require('simple-http-proxy'),
    async = require('async');

var KIELER_URL = 'http://kieler.herokuapp.com';


function develApp() {
  var app = express(),
      handler = proxy(KIELER_URL + '/live'),
      queue = async.queue(function(task, cb) { task(cb); }, 1);

  app.use('/kieler/menu', proxy(KIELER_URL + '/layout/serviceData'));
  app.use('/kieler/layout', function(req, res, next) {
    queue.push(function(cb) {
      res.on('finish', function() { cb(); });
      handler(req, res, next);
    });
  });
  app.use(express.static(__dirname + '/dist'));
  return app;
}


gulp.task('serve', function() {
  var host = '0.0.0.0',
      port = +(process.env.PORT || 5000);
  http.createServer(develApp()).listen(port, host, function() {
    console.log('devel server listening on ' + host + ':' + port);
  })

  return Q.defer().promise;
});


gulp.task('build', function() {
  gulp.src('src/layout.coffee', {read: false})
    .pipe(browserify({
      transform: ['coffeeify'],
      debug: false
    }))
    .pipe(rename('forceLayout.js'))
    .pipe(gulp.dest('dist'));

  gulp.src('src/layout.less')
    .pipe(less())
    .pipe(rename('forceLayout.css'))
    .pipe(gulp.dest('dist'))
});


gulp.task('auto', function() {
  gulp.start('build');
  gulp.watch('src/**/*', ['build']);
});


gulp.task('devel', ['auto', 'serve']);
gulp.task('default', ['build']);

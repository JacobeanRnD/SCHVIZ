var gulp = require('gulp'),
    rename = require('gulp-rename'),
    browserify = require('gulp-browserify'),
    less = require('gulp-less'),
    Q = require('q'),
    http = require('http'),
    express = require('express'),
    proxy = require('simple-http-proxy');

var KIELER_URL = 'http://layout.rtsys.informatik.uni-kiel.de:9444/live';


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


gulp.task('devel', function() {
  gulp.start('auto');

  var app = express(),
      host = '0.0.0.0',
      port = +(process.env.PORT || 5000);

  app.use('/kieler', proxy(KIELER_URL));
  app.use(express.static(__dirname + '/dist'));

  http.createServer(app).listen(port, host, function() {
    console.log('devel server listening on ' + host + ':' + port);
  })

  return Q.defer().promise;
});


gulp.task('default', ['build']);

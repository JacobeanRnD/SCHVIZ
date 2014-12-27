var gulp = require('gulp'),
    rename = require('gulp-rename'),
    coffee = require('gulp-coffee'),
    less = require('gulp-less'),
    sourcemaps = require('gulp-sourcemaps'),
    Q = require('q'),
    http = require('http'),
    express = require('express');


gulp.task('serve', function() {
  var host = '0.0.0.0',
      port = +(process.env.PORT || 5000);
  var app = express()
    .use('/bower_components', express.static(__dirname + '/bower_components'))
    .use('/', express.static(__dirname + '/dist'));
  http.createServer(app).listen(port, host, function() {
    console.log('devel server listening on ' + host + ':' + port);
  })

  return Q.defer().promise;
});


gulp.task('build', function() {
  gulp.src('./src/layout.coffee')
    .pipe(sourcemaps.init())
    .pipe(coffee())
    .pipe(rename('forceLayout.js'))
    .pipe(sourcemaps.write('./'))
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

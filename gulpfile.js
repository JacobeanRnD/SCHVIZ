var gulp = require('gulp'),
    rename = require('gulp-rename'),
    coffee = require('gulp-coffee'),
    less = require('gulp-less'),
    sourcemaps = require('gulp-sourcemaps'),
    Q = require('q');


gulp.task('serve', function() {
  require('coffee-script/register');
  var host = '0.0.0.0';
  var port = +(process.env.PORT || 5000);
  require('./src/server.coffee').serve(host, port);
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

  gulp.src('./src/schviz.coffee')
    .pipe(coffee())
    .pipe(gulp.dest('dist'));

});


gulp.task('auto', function() {
  gulp.start('build');
  gulp.watch('src/**/*', ['build']);
});


gulp.task('devel', ['auto', 'serve']);
gulp.task('default', ['build']);

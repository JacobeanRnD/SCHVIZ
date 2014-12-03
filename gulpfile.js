var gulp = require('gulp'),
    rename = require('gulp-rename'),
    browserify = require('gulp-browserify');


gulp.task('build', function() {
  gulp.src('layout.coffee', {read: false})
    .pipe(browserify({
      transform: ['coffeeify'],
      debug: false
    }))
    .pipe(rename('forceLayout.js'))
    .pipe(gulp.dest('dist'));
});


gulp.task('auto', function() {
  gulp.start('build');
  gulp.watch('**/*.coffee', ['build']);
});


gulp.task('default', ['build']);

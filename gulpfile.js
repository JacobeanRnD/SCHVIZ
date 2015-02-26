var gulp = require('gulp'),
    rename = require('gulp-rename'),
    coffee = require('gulp-coffee'),
    less = require('gulp-less'),
    sourcemaps = require('gulp-sourcemaps'),
    Q = require('q'),
    http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    fs = require('fs');


gulp.task('serve', function() {
  var host = '0.0.0.0',
      port = +(process.env.PORT || 5000);
  var app = express()
    .get('/schviz.js', function(req, res) {
      var jsUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
      var apiUrl = jsUrl.slice(0, jsUrl.length - 3);
      var src = fs.readFileSync(__dirname + '/dist/schviz.js');
      res.type('.js').send('window.SCHVIZ_URL = "' + apiUrl + '";\n\n' + src);
    })
    .use('/bower_components', express.static(__dirname + '/bower_components'))
    .use('/', express.static(__dirname + '/dist'))
    .use(bodyParser.urlencoded({ extended: true }))
    .post('/schviz', function(req, res) {
      var html = fs.readFileSync(__dirname + '/src/schviz.html', {encoding: 'utf8'});
      var json = JSON.stringify(req.body.src);
      res.send(html.replace('//CALL', 'show(' + json + ');'));
    });
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

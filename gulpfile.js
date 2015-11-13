// Modules

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var express = require('express');
var gulp = require('gulp');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var data = require('gulp-data');
var swig = require('gulp-swig');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
var rev = require('gulp-rev');
var clean = require('gulp-clean');
var sequence = require('gulp-sequence');
var prettify = require('gulp-prettify');
var foreach = require('gulp-foreach');

// Custom helpers

function getFileData(filePath) {

  return fs.existsSync(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  var baseData = getFileData('./build/_base.json');
  var filePath = './build/' + path.basename(file.path);
  var tplData = getFileData(filePath.substr(0, filePath.lastIndexOf('.')) + '.json');
  return _.assign(baseData, tplData);

}

// Tasks

gulp.task('clean', function () {

  return gulp
  .src('dist', {read: false})
  .pipe(clean());

});

gulp.task('setup', function () {

  return gulp
  .src(['./build/static/images/**/*', './build/static/fonts/**/*'], {
    base: './build/static'
  })
  .pipe(gulp.dest('./dist/static'));

});

gulp.task('sass', function () {

  return gulp
  .src('./build/static/styles/**/*.scss')
  .pipe(foreach(function (stream, file) {
    var fileName = path.basename(file.path);
    return stream
    .pipe(sass({
      outputStyle: 'compressed',
      outFile: fileName.substr(0, fileName.lastIndexOf('.')) + '.css'
    }));
  }))
  .pipe(gulp.dest('./dist/static/styles'));

});

gulp.task('build', function() {

  return gulp
  .src('./build/[^_]*.html')
  .pipe(data(getTemplateData))
  .pipe(swig())
  .pipe(useref())
  .pipe(gulpif('*.js', uglify()))
  .pipe(gulpif('*.html', prettify({
    indent_size: 2
  })))
  .pipe(gulp.dest('./dist'));

});

gulp.task('server', function () {

  var app = express();
  app.use(express.static('dist'));
  var chain = Promise.resolve().then(startApp);

  function startApp() {

    return new Promise(function (res) {
      var inst = app.listen(4000, function () {
        res(inst);
      });
    });

  }

  function stopApp(instance) {

    return instance.close();

  }

  function rebuildApp(instance) {

    return new Promise(function (res) {
      sequence('default')(function () {
        res(instance);
      });
    });

  }

  gulp.watch('./build/**/*', function () {

    chain = chain.then(stopApp).then(rebuildApp).then(startApp);

  });

});

gulp.task('default', function (cb) {

  sequence('clean', 'setup', 'sass', 'build')(cb);

});
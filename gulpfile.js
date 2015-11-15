// Modules

var fs = require('fs-extra');
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
var reveasy = require('gulp-rev-easy');
var jimp = require('jimp');

// Root paths

var appRoot = require('app-root-path');
var projectRoot = __dirname;

// Drudge config

var config = _.assign(getFileData(projectRoot + '/drudge.json'), getFileData(appRoot + '/drudge.json'));
var paths = config.paths;

// Custom helpers

function pathExists(filePath) {

  try {
    var stat = fs.statSync(filePath);
    return stat.isFile() || stat.isDirectory();
  }
  catch (err) {
    return false;
  }

}

function getFileData(filePath) {

  return pathExists(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  var filePath = file.path;
  var filePathWithoutSuffix = filePath.substr(0, filePath.lastIndexOf('.'));
  var tplData = getFileData(filePathWithoutSuffix + '.json');
  return _.assign(config.data, tplData);

}

// Tasks

gulp.task('clean', function () {

  return gulp
  .src(paths.dist, {read: false})
  .pipe(clean());

});

gulp.task('setup', function (cb) {

  fs.copySync(paths.build + paths.images, paths.dist + paths.images);
  fs.copySync(paths.build + paths.fonts, paths.dist + paths.fonts);
  fs.ensureDirSync(paths.dist + paths.scripts);
  fs.ensureDirSync(paths.dist + paths.styles);
  cb();

});

gulp.task('sass', function () {

  return gulp
  .src(paths.build + paths.styles + '/**/*.scss')
  .pipe(foreach(function (stream, file) {
    var fileName = path.basename(file.path);
    return stream
    .pipe(sass({
      outputStyle: 'compressed',
      outFile: fileName.substr(0, fileName.lastIndexOf('.')) + '.css'
    }));
  }))
  .pipe(gulp.dest(paths.dist + paths.styles));

});

gulp.task('build', function() {

  return gulp
  .src(paths.build + '/**/[^_]*.html')
  .pipe(data(getTemplateData))
  .pipe(swig())
  .pipe(useref())
  .pipe(gulpif('*.js', uglify()))
  .pipe(gulpif('*.html', prettify({
    indent_size: 2
  })))
  .pipe(gulp.dest(paths.dist));

});

gulp.task('rev', function() {

  return gulp
  .src(paths.dist + '/**/*.html')
  .pipe(reveasy({
    elementAttributes: {
      js: {
        name: 'script',
        src: 'src'
      },
      css: {
        name: 'link[type="text/css"]',
        src: 'href'
      },
      favicon: {
        name: 'link[type="image/png"]',
        src: 'href'
      },
      img:{
        name: 'img',
        src : 'src'
      }
    }
  }))
  .pipe(gulp.dest(paths.dist));

});

gulp.task('server', function () {

  var app = express();
  app.use(express.static(paths.dist));
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

  gulp.watch(paths.build + '/**/*', function () {

    chain = chain.then(stopApp).then(rebuildApp).then(startApp);

  });

});

gulp.task('install', function (cb) {

  // If build folder exists already let's only update the _base.html file.
  if (pathExists(paths.build)) {
    fs.copySync(projectRoot + '/_base.html', paths.build + '/_base.html');
  }
  // If build folder does not exist let's copy it from project to the specified destination.
  else {
    fs.copySync(paths.build + paths.fonts, paths.build);
  }

  cb();

});

gulp.task('default', function (cb) {

  sequence('clean', 'setup', 'sass', 'build', 'rev')(cb);

});

// Module API

module.exports = {
  install: function () {
    return new Promise(function (res) {
      sequence('install')(res);
    });
  },
  build: function () {
    return new Promise(function (res) {
      sequence('build')(res);
    });
  },
  server: function () {
    return new Promise(function (res) {
      sequence('server')(res);
    });
  }
};
// Modules

var fs = require('fs-extra');
var path = require('path');
var del = require('del');
var _ = require('lodash');
var express = require('express');
var gulp = require('gulp');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var data = require('gulp-data');
var swig = require('gulp-swig');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
var sequence = require('gulp-sequence');
var prettify = require('gulp-prettify');
var foreach = require('gulp-foreach');
var reveasy = require('gulp-rev-easy');
var jimp = require('jimp');

// Root paths

var appRoot = require('app-root-path');
var projectRoot = __dirname;

// Package data

var pkg = getFileData(projectRoot + '/package.json');

// Drudge config

var cfg = _.assign({}, getFileData(projectRoot + '/drudge.json'), getFileData(appRoot + '/drudge.json')) || {};
var tplCoreData = {config: typeof cfg.config === 'object' ? cfg.config : {}};

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
  var tplData = getFileData(filePathWithoutSuffix + '.ctx.json');
  return _.assign({}, tplCoreData, tplData);

}

function generateImages() {

  var promises = [];
  var sets = (cfg.resize_images || []);
  sets.forEach(function (set) {
    set.sizes.forEach(function (size) {
      var sourcePath = cfg.build + set.source;
      var targetPath = cfg.dist + set.target.replace('{{ width }}', size[0]).replace('{{ height }}', size[1]);
      if (!pathExists(targetPath)) {
        var promise = jimp.read(sourcePath).then(function (img) {
          return img.resize(size[0], size[1]).write(targetPath);
        });
        promises.push(promise);
      }
    });
  });

  return Promise.all(promises);

}

// Tasks

// setup
// *****
// 1. Deletes current dist directory.
// 2. Creates a fresh dist directory.
// 3. Clones the build directory contents to dist directory.
// 4. Removes ignored files from dist directory.
gulp.task('_setup', function () {

  // Ignore paths are relative paths so we need to
  // prepend the distribution directory's path
  // to all ignore paths.
  var ignorePaths = cfg.ignore.map(function (val) {
    return cfg.dist + val;
  });

  fs.removeSync(cfg.dist);
  fs.copySync(cfg.build, cfg.dist);
  return del(ignorePaths);

});

// sass
// ****
// Compile Sass files in build folder to css files
// and place them to dist folder.
gulp.task('_sass', function () {

  return gulp
  .src(cfg.build + cfg.sass_root + '/**/*.scss')
  .pipe(foreach(function (stream, file) {
    var outFile = path.basename(file.path);
    outFile = outFile.substr(0, outFile.lastIndexOf('.')) + '.css';
    return stream.pipe(sass({
      outputStyle: 'compact',
      outFile: outFile
    }));
  }))
  .pipe(gulp.dest(cfg.dist + cfg.sass_root));

});

// templates-scripts
// *****************
// 1. Compile all swig templates into publishable html files.
// 2. Concatenate and minify scripts based on the markers in the swig templates.
// 3. Prettify html files.
// 4. Move the compiled templates and scripts to dist folder.
gulp.task('_templates-scripts', function() {

  return gulp
  .src(cfg.build + '/**/[^_]*.html')
  .pipe(data(getTemplateData))
  .pipe(swig())
  .pipe(useref())
  .pipe(gulpif('*.js', uglify()))
  .pipe(gulpif('*.html', prettify({
    indent_size: 2
  })))
  .pipe(gulp.dest(cfg.dist));

});

// images
// ******
// Create resized versions of all configured images.
gulp.task('_images', function (cb) {

  generateImages().then(function () {
    cb();
  }, function (err) {
    cb(err);
  });

});

// rev
// ***
// Cache bust static files.
gulp.task('_rev', function() {

  return gulp
  .src(cfg.dist + '/**/*.html')
  .pipe(reveasy({
    base: cfg.dist,
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
  .pipe(gulp.dest(cfg.dist));

});

// init
// ****
// Clone build folder and drudge.json file from the module root to the app root.
gulp.task('init', function (cb) {

  // If build folder does not exist already in the current project let's copy it there.
  if (!pathExists(cfg.build)) {
    fs.copySync(projectRoot + '/build', cfg.build);
  }

  // If drudge.json config file does not exist already in the current project let's copy it there.
  if (!pathExists(appRoot + '/drudge.json')) {
    fs.copySync(projectRoot + '/drudge.json', appRoot + '/drudge.json');
  }

  cb();

});

// build
// *****
// As the name implies, execute all the stages needed for creating a working static site.
gulp.task('build', function (cb) {

  sequence('_setup', '_sass', '_templates-scripts', '_images', '_rev')(cb);

});

// server
// ******
// Fire up a test server.
gulp.task('server', function () {

  var app = express();
  app.use(express.static(cfg.dist));
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
      sequence('build')(function () {
        res(instance);
      });
    });

  }

  gulp.watch(cfg.build + '/**/*', function () {

    chain = chain.then(stopApp).then(rebuildApp).then(startApp);

  });

});

// Module API

module.exports = {
  init: function () {
    return new Promise(function (res) {
      sequence('init')(res);
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
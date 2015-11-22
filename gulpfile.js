// Modules

var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var del = require('del');
var htmlMinifier = require('html-minifier').minify;
var nunjucks = require('nunjucks');
var jimp = require('jimp');
var browserSync = require('browser-sync').create();
var gulp = require('gulp');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
var sequence = require('gulp-sequence');
var foreach = require('gulp-foreach');
var revAll = require('gulp-rev-all');
var jscs = require('gulp-jscs');
var change = require('gulp-change');
var jsValidate = require('gulp-jsvalidate');
var imagemin = require('gulp-imagemin');

// Root paths

var appRoot = require('app-root-path');
var projectRoot = __dirname;

// Drudge config

var cfg = _.assign({}, getFileData(projectRoot + '/drudge.json'), getFileData(appRoot + '/drudge.json')) || {};

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

function generateSource(root, src) {

  if (typeof src === 'string') {
    return root + src;
  }
  else {
    return src.map(function (val) {
      return root + val;
    });
  }

}

function nunjucksRender(content) {

  var file = this.file;
  nunjucks.configure(cfg.buildPath, {autoescape: true});
  return nunjucks.render(path.relative(cfg.buildPath, file.path), getTemplateData(file));

}

function minifyHtml(content) {

  return htmlMinifier(content, cfg.htmlMinifierOptions);

}

function getFileData(filePath) {

  return pathExists(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  var filePath = file.path;
  var filePathWithoutSuffix = filePath.substr(0, filePath.lastIndexOf('.'));
  var tplData = getFileData(filePathWithoutSuffix + '.ctx.json');
  return _.assign({}, (cfg.templateData || {}), tplData);

}

function generateImages() {

  var promises = [];
  var sets = (cfg.generateImages || []);
  sets.forEach(function (set) {
    set.sizes.forEach(function (size) {
      var sourcePath = cfg.buildPath + set.source;
      var targetPath = cfg.distPath + set.target.replace('{{ width }}', size[0]).replace('{{ height }}', size[1]);
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
// 1. Deletes current dist (and potential temporary dist) directory.
// 2. Creates a fresh dist directory.
// 3. Clones the build directory contents to dist directory.
// 4. Removes ignored files from dist directory.
gulp.task('_setup', function () {

  fs.removeSync(cfg.distPath);
  fs.removeSync(cfg.distPath + '_tmp');
  fs.copySync(cfg.buildPath, cfg.distPath);
  return del(generateSource(cfg.distPath, cfg.ignore));

});

// validate-js
// ***********
// Check all JavaScript files for syntax errors.
gulp.task('_validate-js', function () {

  return gulp
  .src(cfg.buildPath + '/**/*.js')
  .pipe(jsValidate());

});

// jscs
// ****
// Make sure that JavaScript files are written in correct style.
gulp.task('_jscs', function (cb) {

  if (typeof cfg.jscs === 'object' && cfg.jscs.source) {
    return gulp
    .src(generateSource(cfg.buildPath, cfg.jscs.source))
    .pipe(jscs({configPath: cfg.jscs.configPath}))
    .pipe(jscs.reporter());
  }
  else {
    cb();
  }

});

// sass
// ****
// Compile Sass files in build folder to css files
// and place them to dist folder.
gulp.task('_sass', function () {

  return gulp
  .src(generateSource(cfg.buildPath, cfg.sass.source))
  .pipe(foreach(function (stream, file) {
    var sassOptions = cfg.sass.options || {};
    var outFile = path.basename(file.path);
    outFile = outFile.substr(0, outFile.lastIndexOf('.')) + '.css';
    sassOptions.outFile = sassOptions.outFile || outFile;
    sassOptions.outputStyle = sassOptions.outputStyle || 'compact';
    return stream.pipe(sass(sassOptions));
  }))
  .pipe(gulp.dest(cfg.distPath + cfg.sass.destination));

});

// templates
// *********
// 1. Compile Nunjucks templates into static html files.
// 2. Concatenate and minify scripts based on the markers in the templates.
// 3. Prettify html files.
// 4. Move the compiled templates and scripts to dist folder.
gulp.task('_templates', function() {

  return gulp
  .src(generateSource(cfg.buildPath, cfg.templates.source))
  .pipe(change(nunjucksRender))
  .pipe(useref())
  .pipe(gulpif('*.js', uglify(cfg.uglifyOptions || {})))
  .pipe(gulpif('*.html', change(minifyHtml)))
  .pipe(gulp.dest(cfg.distPath + cfg.templates.destination));

});

// images
// ******
// Create resized versions of all configured images.
gulp.task('_generate-images', function (cb) {

  generateImages().then(function () {
    cb();
  }, function (err) {
    cb(err);
  });

});

// optimize-images
// ***************
// Make sure images are as compressed as they can be.
gulp.task('_optimize-images', function () {

  return gulp
  .src(generateSource(cfg.distPath, cfg.imagemin.source))
  .pipe(imagemin(cfg.imagemin.options || {}))
  .pipe(gulp.dest(cfg.distPath + cfg.imagemin.destination));

});

// rev
// ***
// Cache bust static files.
gulp.task('_rev', function() {

  return gulp
  .src(cfg.distPath + '/**')
  .pipe(new revAll({dontRenameFile: ['.html', '.xml', '.json']}).revision())
  .pipe(gulp.dest(cfg.distPath + '_tmp'));

});

// finalize
// ********
// Replace dist folder with temporary dist folder.
gulp.task('_finalize', function (cb) {

  fs.removeSync(cfg.distPath);
  fs.renameSync(cfg.distPath + '_tmp', cfg.distPath);
  cb();

});

// init
// ****
// Clone build folder and drudge.json file from the module root to the app root.
gulp.task('init', function (cb) {

  // If build folder does not exist already in the current project let's copy it there.
  if (!pathExists(cfg.buildPath)) {
    fs.copySync(projectRoot + '/build', cfg.buildPath);
  }

  // If drudge.json config file does not exist already in the current project let's copy it there.
  if (!pathExists(appRoot + '/drudge.json')) {
    fs.copySync(projectRoot + '/drudge.json', appRoot + '/drudge.json');
  }

  cb();

});

// reload
// ******
// Helper task for browserSync to run build task before reloading the browsers.
gulp.task('_reload', function (cb) {

  sequence('build')(function () {
    browserSync.reload();
    cb();
  });

});

// build
// *****
// As the name implies, execute all the stages needed for creating a working static site.
gulp.task('build', function (cb) {

  sequence('_setup', '_validate-js', '_jscs', '_sass', '_templates', '_generate-images', '_optimize-images', '_rev', '_finalize')(cb);

});

// serve
// *****
// Start up a local development server.
gulp.task('server', ['build'], function () {

  browserSync.init(cfg.browserSync.options);
  gulp.watch(cfg.browserSync.watchSource, ['_reload']);

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
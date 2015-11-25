//
// Modules
//

var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var del = require('del');
var htmlMinifier = require('html-minifier').minify;
var nunjucks = require('nunjucks');
var nunjucksMarkdown = require('nunjucks-markdown');
var marked = require('marked');
var jimp = require('jimp');
var appRoot = require('app-root-path');
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
var w3cjs = require('gulp-w3cjs'); // https://www.npmjs.com/package/gulp-htmlhint another alternative/parallel linter.
var imagemin = require('gulp-imagemin');

//
// Setup
//

// Get project root path.
var projectRoot = __dirname;

// Get drudge configuration.
var cfg = _.assign({}, getFileData(projectRoot + '/drudge.config.js'), getFileData(appRoot + '/drudge.config.js')) || {};

// Temporary distribution path.
var tempDistPath = cfg.distPath + '_tmp';

// Setup marked.
if (_.isPlainObject(cfg.marked)) {
  marked.setOptions(cfg.marked);
}

// Set up marked for nunjucks.
nunjucksMarkdown.register(nunjucks.configure('views'), marked);

// Setup nunjucks.
nunjucks.configure(cfg.buildPath, _.isPlainObject(cfg.nunjucks) ? cfg.nunjucks : {});

//
// Custom helpers
//

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

  if (_.isString(src)) {
    return [root + src];
  }
  else if (_.isArray(src)) {
    return src.map(function (val) {
      return root + val;
    });
  }
  else {
    return [];
  }

}

function getFileData(filePath) {

  return pathExists(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  var filePath = file.path;
  var filePathWithoutSuffix = filePath.substr(0, filePath.lastIndexOf('.'));
  var tplCoreData = _.isPlainObject(cfg.templateData) ? cfg.templateData : {};
  var tplJsonData = getFileData(filePathWithoutSuffix + '.ctx.json');
  var tplJsData = getFileData(filePathWithoutSuffix + '.ctx.js');
  if (_.isFunction(tplJsData)) {
    tplJsData = tplJsData(tplCoreData, tplJsonData);
  }
  return _.assign({}, tplCoreData, tplJsonData, tplJsData);

}

function nunjucksRender(content) {

  var file = this.file;
  return nunjucks.render(path.relative(cfg.buildPath, file.path), getTemplateData(file));

}

function minifyHtml(content) {

  return htmlMinifier(content, cfg.htmlMinifier);

}

function uglifyCondition(file) {

  return path.extname(file.path) === '.js' && _.isPlainObject(cfg.uglify);

}

function minifyCondition(file) {

  return path.extname(file.path) === '.html' && _.isPlainObject(cfg.htmlMinifier);

}

function htmlValidateCondition(file) {

  return path.extname(file.path) === '.html' && _.isPlainObject(cfg.w3cjs);

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

//
// Tasks
//

// setup
// *****
// 1. Deletes current dist (and potential temporary dist) directory.
// 2. Creates a fresh dist directory.
// 3. Clones the build directory contents to dist directory.
// 4. Removes ignored files from dist directory.
gulp.task('_setup', function () {

  var defaultIgnores = generateSource(cfg.distPath, ['/**/*.html', '/**/*.ctx.json', '/**/*.ctx.js']);
  fs.removeSync(cfg.distPath);
  fs.removeSync(tempDistPath);
  fs.copySync(cfg.buildPath, cfg.distPath);
  return del(generateSource(cfg.distPath, cfg.ignore).concat(defaultIgnores));

});

// validate-js
// ***********
// Check all JavaScript files for syntax errors.
gulp.task('_validate-js', function (cb) {

  if (cfg.validateJs) {
    return gulp
    .src(cfg.buildPath + '/**/*.js', {base: cfg.buildPath})
    .pipe(jsValidate());
  }
  else {
    cb();
  }

});

// jscs
// ****
// Make sure that JavaScript files are written in correct style.
gulp.task('_jscs', function (cb) {

  if (_.isPlainObject(cfg.jscs)) {
    return gulp
    .src(generateSource(cfg.buildPath, cfg.jscs.files), {base: cfg.buildPath})
    .pipe(jscs({configPath: cfg.jscs.configPath}))
    .pipe(jscs.reporter());
  }
  else {
    cb();
  }

});

// sass
// ****
// Compile Sass stylesheets in build folder to static css files into dist folder.
gulp.task('_sass', function (cb) {

  if (_.isPlainObject(cfg.sass)) {
    return gulp
    .src(generateSource(cfg.buildPath, ['/**/*.scss', '/**/*.sass']), {base: cfg.buildPath})
    .pipe(foreach(function (stream, file) {
      var sassOpts = cfg.sass || {};
      var outFile = path.basename(file.path);
      sassOpts.outFile = outFile.substr(0, outFile.lastIndexOf('.')) + '.css';
      return stream.pipe(sass(sassOpts));
    }))
    .pipe(gulp.dest(cfg.distPath));
  }
  else {
    cb();
  }

});

// templates
// *********
// 1. Compile Nunjucks templates into static html files.
// 2. Concatenate and minify scripts based on the markers in the templates.
// 3. Prettify html files.
// 4. Move the compiled templates and scripts to dist folder.
gulp.task('_templates', function() {

  return gulp
  .src(generateSource(cfg.buildPath, '/**/[^_]*.html'), {base: cfg.buildPath})
  .pipe(change(nunjucksRender))
  .pipe(useref())
  .pipe(gulpif(uglifyCondition, uglify(cfg.uglify)))
  .pipe(gulpif(minifyCondition, change(minifyHtml)))
  .pipe(gulpif(htmlValidateCondition, w3cjs(cfg.w3cjs)))
  .pipe(gulpif(htmlValidateCondition, w3cjs.reporter()))
  .pipe(gulp.dest(cfg.distPath));

});

// generate-images
// ***************
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
gulp.task('_optimize-images', function (cb) {

  if (_.isPlainObject(cfg.imagemin)) {
    return gulp
    .src(generateSource(cfg.distPath, cfg.imagemin.files), {base: cfg.distPath})
    .pipe(imagemin(cfg.imagemin.options))
    .pipe(gulp.dest(cfg.distPath));
  }
  else {
    cb();
  }

});

// rev
// ***
// Revision files.
gulp.task('_rev', function (cb) {

  if (_.isPlainObject(cfg.rev)) {
    return gulp
    .src(cfg.distPath + '/**')
    .pipe(new revAll(cfg.rev).revision())
    .pipe(gulp.dest(tempDistPath));
  }
  else {
    cb();
  }

});

// end
// ***
// Clean up temporary distribution folder.
gulp.task('_end', function (cb) {

  fs.removeSync(cfg.distPath);
  fs.renameSync(tempDistPath, cfg.distPath);
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

// init
// ****
// Clone build folder and drudge.json file from the module root to the app root.
gulp.task('init', function (cb) {

  // If build folder does not exist already in the current project let's copy it there.
  if (!pathExists(cfg.buildPath)) {
    fs.copySync(projectRoot + '/build', cfg.buildPath);
  }

  // If drudge.json config file does not exist already in the current project let's copy it there.
  if (!pathExists(appRoot + '/drudge.config.js')) {
    fs.copySync(projectRoot + '/drudge.config.js', appRoot + '/drudge.config.js');
  }

  cb();

});

// build
// *****
// As the name implies, execute all the stages needed for creating a working static site.
gulp.task('build', function (cb) {

  sequence('_setup', '_validate-js', '_jscs', '_sass', '_templates', '_generate-images', '_optimize-images', '_rev', '_end')(cb);

});

// serve
// *****
// Start up a local development server.
gulp.task('server', ['build'], function () {

  browserSync.init(cfg.browserSync.options);
  gulp.watch(config.buildPath + '/**/*', ['_reload']);

});

//
// Exports
//

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
// TODO
// ----
// * Better error reporting (maybe an optional log file for erros or something).
// * Make build faster -> hardocre perf optimizations.
// * Generate multisize favicon.ico (16+24+32+48).
// * Generate site SEO/PS report (page by page).
//   * PageSpeed insights (node psi module).
//   * SEO analysis (a mixture of node modules).
//     * Check h1 tag existence (warn if more than one exists or none exist).
//     * Check title and description meta tags (warn if missing or empty).
//     * Check page crawlability (robots.txt / <meta name="robots" content="noindex, nofollow">).
//     * Check image alt tags (warn if missing or empty).
//     * Check for broken links (warn if broken).

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
var yamljs = require('yamljs');
var through2 = require('through2');
var js2xmlparser = require("js2xmlparser");
var gulp = require('gulp');
var sass = require('gulp-sass');
var sassLint = require('gulp-sass-lint');
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
var sitemap = require('gulp-sitemap');
var uncss = require('gulp-uncss');

//
// Setup
//

// Get project root path.
var projectRoot = __dirname;

// Drudge configuration file path (relative).
var configPath = '/drudge.config.js';

// Get drudge configuration.
var cfg = _.assign({}, getFileData(projectRoot + configPath), getFileData(appRoot + configPath)) || {};

// Temporary distribution path.
var tempDistPath = cfg.distPath + '_tmp';

// Setup marked.
if (_.isPlainObject(cfg.marked)) {
  marked.setOptions(cfg.marked);
}

// Set up marked for nunjucks.
nunjucksMarkdown.register(nunjucks.configure('views'), marked);

// Setup nunjucks.
nunjucks.configure(cfg.srcPath, _.isPlainObject(cfg.nunjucks) ? cfg.nunjucks : {});

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
  return nunjucks.render(path.relative(cfg.srcPath, file.path), getTemplateData(file));

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

function w3cjsReporter() {

  return through2.obj(function (file, enc, cb) {
    cb(null, file);
    if (!file.w3cjs.success) {
      console.log('HTML validation error(s) found');
    }
  });

}

function generateImages() {

  var promises = [];
  var sets = (cfg.generateImages || []);
  sets.forEach(function (set) {
    set.sizes.forEach(function (size) {
      var sourcePath = cfg.srcPath + set.source;
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

// validate-js
// ***********
// Phase: pre-build
// Check all JavaScript files for syntax errors.
gulp.task('validate-js', function (cb) {

  if (cfg.validateJs) {
    return gulp
    .src(cfg.srcPath + '/**/*.js', {base: cfg.srcPath})
    .pipe(jsValidate());
  }
  else {
    cb();
  }

});

// lint-js
// *******
// Phase: pre-build
// Make sure that JavaScript files are written in correct style.
gulp.task('lint-js', function (cb) {

  if (_.isPlainObject(cfg.jscs)) {
    return gulp
    .src(generateSource(cfg.srcPath, cfg.jscs.files), {base: cfg.srcPath})
    .pipe(jscs({configPath: cfg.jscs.configPath}))
    .pipe(jscs.reporter());
  }
  else {
    cb();
  }

});

// lint-sass
// *********
// Phase: pre-build
// Lint SASS stylesheets.
gulp.task('lint-sass', function (cb) {

  if (_.isPlainObject(cfg.sassLint)) {
    return gulp
    .src(generateSource(cfg.srcPath, cfg.sassLint.files), {base: cfg.srcPath})
    .pipe(sassLint(yamljs.load(cfg.sassLint.configPath)))
    .pipe(sassLint.format())
    .pipe(sassLint.failOnError());
  }
  else {
    cb();
  }

});

// setup
// *****
// Phase: build
// 1. Deletes dist (and temporary dist) directory.
// 2. Creates a fresh dist directory.
// 3. Clones the source directory contents to distribution directory.
// 4. Removes ignored files from dist directory.
gulp.task('setup', function () {

  var defaultIgnores = generateSource(cfg.distPath, ['/**/*.html', '/**/*.ctx.json', '/**/*.ctx.js']);
  fs.removeSync(cfg.distPath);
  fs.removeSync(tempDistPath);
  fs.copySync(cfg.srcPath, cfg.distPath);
  return del(generateSource(cfg.distPath, cfg.ignore).concat(defaultIgnores));

});

// compile-sass
// ************
// Phase: build
// Compile SASS stylesheets from source directory to dist directory.
gulp.task('compile-sass', function (cb) {

  if (_.isPlainObject(cfg.sass)) {
    return gulp
    .src(generateSource(cfg.srcPath, '/**/*.s+(a|c)ss'), {base: cfg.srcPath})
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

// compile-templates
// *****************
// Phase: build
// 1. Compile Nunjucks templates into static HTML files.
// 2. Concatenate and minify scripts based on the markers in the templates.
// 3. Minify HTML files.
// 4. Move the compiled templates and scripts to dist directory.
gulp.task('compile-templates', function() {

  return gulp
  .src(generateSource(cfg.srcPath, '/**/[^_]*.html'), {base: cfg.srcPath})
  .pipe(change(nunjucksRender))
  .pipe(useref())
  .pipe(gulpif(uglifyCondition, uglify(cfg.uglify)))
  .pipe(gulpif(minifyCondition, change(minifyHtml)))
  .pipe(gulp.dest(cfg.distPath));

});

// generate-images
// ***************
// Phase: build
// Create resized versions of all configured images.
gulp.task('generate-images', function (cb) {

  generateImages().then(function () {
    cb();
  }, function (err) {
    cb(err);
  });

});

// optimize-images
// ***************
// Phase: build
// Make sure images are as compressed as they can be.
gulp.task('optimize-images', function (cb) {

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

// build-sitemap
// *************
// Phase: build
// Build sitemap from html files.
gulp.task('build-sitemap', function (cb) {

  if (_.isPlainObject(cfg.sitemap)) {
    return gulp
    .src(generateSource(cfg.distPath, '/**/*.html'), {base: cfg.distPath})
    .pipe(sitemap(cfg.sitemap))
    .pipe(gulp.dest(cfg.distPath));
  }
  else {
    cb();
  }

});

// build-browserconfig
// *******************
// Phase: build
// Build browserconfig.xml.
gulp.task('build-browserconfig', function (cb) {

  if (cfg.browserconfig) {

    var data = js2xmlparser('browserconfig', {
      'msapplication': {
        'tile': {
          'square70x70logo': {'@': {'src': cfg.browserconfig.tile70x70}},
          'square150x150logo': {'@': {'src': cfg.browserconfig.tile150x150}},
          'square310x150logo': {'@': {'src': cfg.browserconfig.tile310x150}},
          'square310x310logo': {'@': {'src': cfg.browserconfig.tile310x310}},
          'TileColor': cfg.browserconfig.tileColor
        }
      }
    });

    fs.writeFile(cfg.distPath + '/browserconfig.xml', data, function (err) {
      if (err) cb(err);
      cb();
    });

  }
  else {

    cb();

  }

});

// uncss
// *****
// Phase: build
// Remove unused styles from compiled CSS stylesheets.
gulp.task('uncss', function () {

  if (_.isPlainObject(cfg.uncss)) {
    return gulp
    .src(generateSource(cfg.distPath, '/**/*.css'), {base: cfg.distPath})
    .pipe(uncss(cfg.uncss))
    .pipe(sass(cfg.sass))
    .pipe(gulp.dest(cfg.distPath));
  }
  else {
    cb();
  }

});

// compile-sass
// ************
// Phase: build
// Compile SASS stylesheets from source directory to dist directory.
gulp.task('compile-sass', function (cb) {

  if (_.isPlainObject(cfg.sass)) {
    return gulp
    .src(generateSource(cfg.srcPath, '/**/*.s+(a|c)ss'), {base: cfg.srcPath})
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

// revision
// ********
// Phase: build
// Revision files.
gulp.task('revision', function (cb) {

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

// revision-cleanup
// ****************
// Phase: build
// Clean up the havoc revisioning caused.
gulp.task('revision-cleanup', function (cb) {

  fs.removeSync(cfg.distPath);
  fs.renameSync(tempDistPath, cfg.distPath);
  cb();

});

// validate-html
// *************
// Phase: post-build
// Validate HTML markup against W3C standards.
gulp.task('validate-html', function (cb) {

  if (_.isPlainObject(cfg.w3cjs)) {
    return gulp
    .src(generateSource(cfg.distPath, '/**/*.html'), {base: cfg.distPath})
    .pipe(w3cjs(cfg.w3cjs))
    .pipe(w3cjsReporter());
  }
  else {
    cb();
  }

});

// pre-build
// *********
// Validate source files.
gulp.task('pre-build', function (cb) {

  sequence('validate-js', 'lint-js', 'lint-sass')(cb);

});

// build
// *****
// Build the distribution directory from the source files.
gulp.task('build', function (cb) {

  sequence('setup', 'compile-sass', 'compile-templates', 'generate-images', 'optimize-images', 'build-sitemap', 'build-browserconfig', 'uncss', 'revision', 'revision-cleanup')(cb);

});

// post-build
// **********
// Validate the distribution files.
gulp.task('post-build', function (cb) {

  sequence('validate-html')(cb);

});

// init
// ****
// Clone source directory and drudge configuration file from the module root to the app root.
gulp.task('init', function (cb) {

  if (!pathExists(cfg.srcPath)) {
    fs.copySync(projectRoot + '/src', cfg.buildPath);
  }

  if (!pathExists(appRoot + configPath)) {
    fs.copySync(projectRoot + configPath, appRoot + configPath);
  }

  cb();

});

// reload-server
// *************
// Helper task for browserSync to rebuild when something is changed in the source directory.
gulp.task('server-reload', function (cb) {

  sequence('build')(function () {
    browserSync.reload();
    cb();
  });

});

// server
// ******
// Start up a local development server.
gulp.task('server', ['default'], function () {

  browserSync.init(cfg.browsersync.options);
  gulp.watch(config.srcPath + '/**/*', ['reload-server']);

});

// default
// *******
// Execute the full build process.
gulp.task('default', function (cb) {

  sequence('pre-build', 'build', 'post-build')(cb);

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
      sequence('default')(res);
    });
  },
  server: function () {
    return new Promise(function (res) {
      sequence('server')(res);
    });
  }
};
// TODO for v0.1.0
// ---------------
// * Gulp cache id for each Drudge instance.
// * Sanitize config options on instance creation.
// * Make marked and nunjucks processing optional.
// * Configuration presets for Website, App, Blog.
// * Explain the build process in the readme with pointers to configurations.
// * Babel integration.
// * Esprima + JSCS -> ESLint.
// * Define design goals and philosophy behind the project.
// * Graceful Sass/JS error handling for browsersync server. Invalid JS/SASS should not kill the server process, just gracefully cancel the current build process.
// * Option to warn about console logs and other development related stuff in JavaScript files.
// * Generate multisize favicon.ico (16+24+32+48).
// * Explore another HTML linter: https://www.npmjs.com/package/gulp-htmlhint another alternative/parallel linter.
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
var browserSync = require('browser-sync');
var yamljs = require('yamljs');
var through2 = require('through2');
var js2xmlparser = require("js2xmlparser");
var vinylPaths = require('vinyl-paths');
var gulp = require('gulp');
var util = require('gulp-util');
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
var w3cjs = require('gulp-w3cjs');
var imagemin = require('gulp-imagemin');
var sitemap = require('gulp-sitemap');
var uncss = require('gulp-uncss');
var plumber = require('gulp-plumber');
var cache = require('gulp-cached');
var rename = require('gulp-rename');
var cssnano = require('gulp-cssnano');

//
// Local variables
//

// Get project root path.
var projectRoot = __dirname;

// Drudge configuration file path (relative).
var configPath = '/drudge.config.js';

// Get drudge base configuration.
var baseCfg = getFileData(projectRoot + configPath);

// Build queue.
var buildQueue = Promise.resolve();

// Current build's Drudge instance.
var buildDrudge;

//
// Drudge constructor
//

function Drudge(opts) {

  // Sanitize options.
  opts = _.isPlainObject(opts) ? opts : _.isString(opts) ? getFileData(opts) : {};

  // Store configuration to instance.
  this.config = _.assign({}, baseCfg, opts);

  // Setup temporary distribution directory path.
  this.config.distPathTemp = this.config.distPath + '_tmp';

  // Create Browsersync instance.
  this.browsersync = browserSync.create();

  // Create Nunjucks instance.
  this.nunjucks = nunjucks.configure(this.config.srcPath, _.isPlainObject(this.config.templates) ? forceObj(this.config.templates.options) : {});

}

Drudge.prototype._setup = function () {

  var inst = this;

  return new Promise(function (res) {

    // Setup build instance.
    buildDrudge = inst;

    // Setup marked.
    if (_.isPlainObject(inst.config.templates) && _.isPlainObject(inst.config.templates.markdown)) {
      marked.setOptions(inst.config.templates.markdown);
      nunjucksMarkdown.register(inst.nunjucks, marked);
    }

    res(inst);

  });

};

Drudge.prototype.init = function () {

  var inst = this;
  return new Promise(function (res) {

    if (!pathExists(inst.config.srcPath)) {
      fs.copySync(projectRoot + '/src', inst.config.buildPath);
    }

    if (!pathExists(appRoot + configPath)) {
      fs.copySync(projectRoot + configPath, appRoot + configPath);
    }

    res(inst);

  });

};

Drudge.prototype.build = function () {

  var inst = this;
  buildQueue = buildQueue
  .then(function () {
    return inst._setup();
  })
  .then(function () {
    return new Promise(function (res) {
      sequence('pre-build', 'build', 'post-build')(function () {
        res(inst);
      });
    });
  });
  return buildQueue;

};

Drudge.prototype.server = function () {

  var inst = this;
  return inst.build()
  .then(function () {
    return new Promise(function (res) {
      inst.browsersync.init(forceObj(inst.config.browsersync));
      gulp.watch(inst.config.srcPath + '/**/*', function () {
        inst.build().then(function () {
          inst.browsersync.reload();
        });
      });
      res(inst);
    });
  });

};

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

function genSrc(root, src) {

  if (_.isString(src)) {
    if (src.charAt(0) === '!') {
      return ['!' + root + src.replace('!', '')];
    }
    else {
      return [root + src];
    }
  }
  else if (_.isArray(src)) {
    return src.map(function (val) {
      if (val.charAt(0) === '!') {
        return '!' + root + val.replace('!', '');
      }
      else {
        return root + val;
      }
    });
  }
  else {
    return [];
  }

}

function forceObj(obj) {

  return _.isPlainObject(obj) ? obj : {};

}

function getFileData(filePath) {

  return pathExists(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  // Get template core data.
  var tplCoreData = forceObj(buildDrudge.config.templates.data);

  // Get JSON context file.
  var tplJsonData = path.parse(file.path);
  tplJsonData.name = tplJsonData.name + buildDrudge.config.templates.contextIdentifier;
  tplJsonData.ext = '.json';
  tplJsonData.base = tplJsonData.name + tplJsonData.ext;
  tplJsonData = getFileData(path.format(tplJsonData));

  // Get JS context file.
  var tplJsData = path.parse(file.path);
  tplJsData.name = tplJsData.name + buildDrudge.config.templates.contextIdentifier;
  tplJsData.ext = '.js';
  tplJsData.base = tplJsData.name + tplJsData.ext;
  tplJsData = getFileData(path.format(tplJsData));

  // Provide JSON data as context for JS data function (if it exists).
  if (_.isFunction(tplJsData)) {
    tplJsData = tplJsData(tplCoreData, tplJsonData);
  }

  return _.assign({}, tplCoreData, tplJsonData, tplJsData);

}

function nunjucksRender(content) {

  var file = this.file;
  var data = getTemplateData(file);
  return buildDrudge.nunjucks.render(path.relative(buildDrudge.config.srcPath, file.path), data);

}

function minifyHtml(content) {

  return htmlMinifier(content, forceObj(buildDrudge.config.minifyHtml.options));

}

function w3cjsReporter() {

  return through2.obj(function (file, enc, cb) {
    cb(null, file);
    if (file.w3cjs && !file.w3cjs.success) {
      console.log('HTML validation error(s) found');
    }
  });

}

function generateImages() {

  var promises = [];
  var sets = (buildDrudge.config.generateImages || []);
  sets.forEach(function (set) {
    set.sizes.forEach(function (size) {
      var sourcePath = buildDrudge.config.distPath + set.source;
      var targetPath = buildDrudge.config.distPath + set.target.replace('{{ width }}', size[0]).replace('{{ height }}', size[1]);
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

// Check all JavaScript files for syntax errors.
gulp.task('pre-build:validate-js', function (cb) {

  if (_.isPlainObject(buildDrudge.config.validateJs)) {
    return gulp
    .src(genSrc(buildDrudge.config.srcPath, buildDrudge.config.validateJs.files), {
      base: buildDrudge.config.srcPath
    })
    .pipe(jsValidate());
  }
  else {
    cb();
  }

});

// Make sure that JavaScript files are written in correct style.
gulp.task('pre-build:lint-js', function (cb) {

  if (_.isPlainObject(buildDrudge.config.lintJs)) {
    return gulp
    .src(genSrc(buildDrudge.config.srcPath, buildDrudge.config.lintJs.files), {
      base: buildDrudge.config.srcPath
    })
    .pipe(jscs({configPath: buildDrudge.config.lintJs.configPath}))
    .pipe(jscs.reporter());
  }
  else {
    cb();
  }

});

// Lint SASS stylesheets.
gulp.task('pre-build:lint-sass', function (cb) {

  if (_.isPlainObject(buildDrudge.config.lintSass)) {
    return gulp
    .src(genSrc(buildDrudge.config.srcPath, buildDrudge.config.lintSass.files), {
      base: buildDrudge.config.srcPath
    })
    .pipe(sassLint(yamljs.load(buildDrudge.config.lintSass.configPath)))
    .pipe(sassLint.format())
    .pipe(sassLint.failOnError());
  }
  else {
    cb();
  }

});

// 1. Delete distribution and temporary distribution directories.
// 2. Clone the source directory as the distribution directory.
// 3. Remove "cleanBefore" files/directories.
gulp.task('build:setup', function () {

  fs.removeSync(buildDrudge.config.distPath);
  fs.removeSync(buildDrudge.config.distPathTemp);
  fs.copySync(buildDrudge.config.srcPath, buildDrudge.config.distPath);

  return gulp
  .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.cleanBefore), {
    base: buildDrudge.config.distPath,
    read: false
  })
  .pipe(vinylPaths(del));

});

// Compile Nunjucks templates. (use srcPath and cache the output templates also)
gulp.task('build:templates', function (cb) {

  if (_.isPlainObject(buildDrudge.config.templates)) {
    return gulp
    .src(genSrc(buildDrudge.config.srcPath, buildDrudge.config.templates.files), {
      base: buildDrudge.config.srcPath
    })
    .pipe(change(nunjucksRender))
    .pipe(rename(function (path) {
      path.basename = path.basename.replace(buildDrudge.config.templates.identifier, '');
    }))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Compile source directory's Sass stylesheets to distribution directory.
gulp.task('build:sass', function (cb) {

  if (_.isPlainObject(buildDrudge.config.sass)) {
    return gulp
    .src(genSrc(buildDrudge.config.srcPath, buildDrudge.config.sass.files), {
      base: buildDrudge.config.srcPath
    })
    .pipe(foreach(function (stream, file) {
      var sassOpts = forceObj(buildDrudge.config.sass.options);
      sassOpts.outFile = util.replaceExtension(path.basename(file.path), 'css');
      return stream.pipe(sass(sassOpts));
    }))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Generate concatenated scripts and styles from useref markers in HTML files within the distribution folder. (cache output js and styles)
gulp.task('build:collect-assets', function (cb) {

  if (_.isPlainObject(buildDrudge.config.collectAssets)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.collectAssets.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(useref())
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Minify all specified scripts in distribution folder.
gulp.task('build:minify-js', function (cb) {

  if (_.isPlainObject(buildDrudge.config.minifyJs)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.minifyJs.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(uglify(forceObj(buildDrudge.config.minifyJs.options)))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Minify all specified html files in distribution folder.
gulp.task('build:minify-html', function (cb) {

  if (_.isPlainObject(buildDrudge.config.minifyHtml)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.minifyHtml.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(change(minifyHtml))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Remove unused styles from all stylesheets.
gulp.task('build:clean-css', function (cb) {

  if (_.isPlainObject(buildDrudge.config.cleanCss)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.cleanCss.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(uncss(forceObj(buildDrudge.config.cleanCss.options)))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Minify specified css files with cssnano.
gulp.task('build:minify-css', function (cb) {

  if (_.isPlainObject(buildDrudge.config.minifyCss)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.minifyCss.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(cssnano())
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Generate sitemap.xml based on the HTML files in distribution directory.
gulp.task('build:sitemap', function (cb) {

  if (_.isPlainObject(buildDrudge.config.sitemap)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.sitemap.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(sitemap(forceObj(buildDrudge.config.sitemap.options)))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Generate browserconfig.xml as configured.
gulp.task('build:browserconfig', function (cb) {

  if (_.isPlainObject(buildDrudge.config.browserconfig)) {

    var data = js2xmlparser('browserconfig', {
      'msapplication': {
        'tile': {
          'square70x70logo': {'@': {'src': buildDrudge.config.browserconfig.tile70x70}},
          'square150x150logo': {'@': {'src': buildDrudge.config.browserconfig.tile150x150}},
          'square310x150logo': {'@': {'src': buildDrudge.config.browserconfig.tile310x150}},
          'square310x310logo': {'@': {'src': buildDrudge.config.browserconfig.tile310x310}},
          'TileColor': buildDrudge.config.browserconfig.tileColor
        }
      }
    });

    fs.writeFile(buildDrudge.config.distPath + '/browserconfig.xml', data, function (err) {
      if (err) cb(err);
      cb();
    });

  }
  else {

    cb();

  }

});

// Generate new images from template images as configured.
gulp.task('build:generate-images', function (cb) {

  generateImages().then(function () {
    cb();
  }, function (err) {
    cb(err);
  });

});

// Optimize images as configured.
gulp.task('build:optimize-images', function (cb) {

  if (_.isPlainObject(buildDrudge.config.optimizeImages)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.optimizeImages.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(imagemin(forceObj(buildDrudge.config.optimizeImages.options)))
    .pipe(gulp.dest(buildDrudge.config.distPath));
  }
  else {
    cb();
  }

});

// Revision files and update occurences of revisioned files.
gulp.task('build:revision', function (cb) {

  if (_.isPlainObject(buildDrudge.config.revision)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.revision.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(new revAll(forceObj(buildDrudge.config.revision.options)).revision())
    .pipe(gulp.dest(buildDrudge.config.distPathTemp));
  }
  else {
    cb();
  }

});

// 1. Remove temporary distribution directory.
// 2. Remove "cleanAfter" files/directories.
gulp.task('build:clean', function (cb) {

  fs.removeSync(buildDrudge.config.distPath);
  fs.renameSync(buildDrudge.config.distPathTemp, buildDrudge.config.distPath);

  return gulp
  .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.cleanAfter), {
    base: buildDrudge.config.distPath,
    read: false
  })
  .pipe(vinylPaths(del));

});

// Validate HTML markup against W3C standards.
gulp.task('post-build:validate-html', function (cb) {

  if (_.isPlainObject(buildDrudge.config.validateHtml)) {
    return gulp
    .src(genSrc(buildDrudge.config.distPath, buildDrudge.config.validateHtml.files), {
      base: buildDrudge.config.distPath
    })
    .pipe(w3cjs())
    .pipe(w3cjsReporter());
  }
  else {
    cb();
  }

});

// Validate source files.
gulp.task('pre-build', function (cb) {

  sequence('pre-build:validate-js', 'pre-build:lint-js', 'pre-build:lint-sass')(cb);

});

// Build the distribution directory from the source files.
gulp.task('build', function (cb) {

  sequence('build:setup', 'build:templates', 'build:sass', 'build:collect-assets', 'build:minify-js', 'build:minify-html', 'build:clean-css', 'build:minify-css', 'build:generate-images', 'build:optimize-images', 'build:sitemap', 'build:browserconfig', 'build:revision', 'build:clean')(cb);

});

// Validate the distribution files.
gulp.task('post-build', function (cb) {

  sequence('post-build:validate-html')(cb);

});

gulp.task('default', function () {

  return (new Drudge()).build();

});

gulp.task('server', function () {

  return (new Drudge()).server();

});

//
// Exports
//

module.exports = function (opts) {

  return new Drudge(opts);

};
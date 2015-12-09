/*

Design goals
============

* Tagline: Highly configurable static site/app/blog/whatever generator.
* Gulp based file streaming that allows hooking into the stream.
* Easy to use and configure with good presets.
* Fast builds. Use advanced file caching techniques to maximize the build speed.
* Everything is optional. At minimun configuration Mylly should only clone the
  source directory and nothing else.

v0.2.0
======
  * [ ] Advanced caching to improve build speed using gulp-cached and
        gulp-remember.
  * [ ] Solid default setup that showcases all features and works as a
        good project skeleton for static websites.
  * [ ] Disable all non-used plugin params.
  * [ ] JSDoc syntax code documentation or some other alternative.
  * [ ] Easier (more restricted) configuration. Consider leaning towards magic
        and conventions instead of configuration.
  * [ ] Docs and readme.
  * [ ] Github pages website, naturally built with Mylly ;)
  * [ ] Unit tests.

v0.3.0
======
  * [ ] Nunjucks powerups
    * [ ] moment.js -> https://www.npmjs.com/package/nunjucks-date-filter
    * [ ] i18n -> https://www.npmjs.com/package/nunjucks-i18n
  * [ ] Create a nice API for the build flow that allows plugging custom
        functionality between the build steps.
  * [ ] CSS/JS sourcemaps.
  * [ ] Generate multisize favicon.ico (16+24+32+48).
  * [ ] Offline HTML validator.
  * [ ] Babel integration (Maybe this is a bad idea, debugging transformed code
        sounds like a massive PITA).
  * [ ] Autoprefixer. Needs a lot of consideration since using it may turn out
        to be a debug nightmare. There are still some open issues the developer
        needs to be aware about and CSS hacks might get broken during the
        post-processing process.
  * [ ] Allow user to define the CSS pre/post processor engine:
        Less/Sass/PostCSS
  * [ ] Basic speed report -> Page by page size report (divided into total size
        per asset type, e.g. scripts, styles, images).
  * [ ] Basic SEO report -> Page by page SEO report.

*/

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
var isOnline = require('is-online');
var filesize = require('filesize');
var gulp = require('gulp');
var gulpUtil = require('gulp-util');
var gulpSass = require('gulp-sass');
var gulpSassLint = require('gulp-sass-lint');
var gulpUglify = require('gulp-uglify');
var gulpUseref = require('gulp-useref');
var gulpSequence = require('gulp-sequence');
var gulpForeach = require('gulp-foreach');
var gulpRevAll = require('gulp-rev-all');
var gulpChange = require('gulp-change');
var gulpW3cjs = require('gulp-w3cjs');
var gulpImagemin = require('gulp-imagemin');
var gulpSitemap = require('gulp-sitemap');
var gulpUncss = require('gulp-uncss');
var gulpCache = require('gulp-cached');
var gulpCssnano = require('gulp-cssnano');
var gulpEslint = require('gulp-eslint');

//
// Local variables
//

// The build tasks (and their dependencies) in the exection order. The first
// item in the build task item array represents the gulp task's name and the
// following items represent which properties (if any) must exist in the
// Mylly configuration object as truthy value in order for the task to be
// included in the Mylly instance's build tasks.
var taskQueue = [
  ['pre-build:lint-js', 'lintJs'],
  ['pre-build:lint-sass', 'lintSass'],
  ['build:setup'],
  ['build:templates', 'templates'],
  ['build:sass', 'sass'],
  ['build:collect-assets', 'collectAssets'],
  ['build:minify-js', 'minifyJs'],
  ['build:minify-html', 'minifyHtml'],
  ['build:clean-css', 'cleanCss'],
  ['build:minify-css', 'minifyCss'],
  ['build:sitemap', 'sitemap'],
  ['build:browserconfig', 'browserconfig'],
  ['build:generate-images', 'generateImages'],
  ['build:optimize-images', 'optimizeImages'],
  ['build:revision', 'revision'],
  ['build:clean'],
  ['post-build:validate-html', 'validateHtml'],
  ['post-build:report', 'buildReport']
];

var allowedConfigTypes = {
  srcPath: ['string'],
  buildPath: ['string'],
  distPath: ['string'],
  lintJs: ['object|null', {
    files: ['array|string'],
    options: ['object|string']
  }],
  lintSass: ['object|null', {
    files: ['array|string'],
    configPath: ['string']
  }],
  templates: ['object|null', {
    files: ['array|string'],
    context: ['string'],
    data: ['object|null'],
    markdown: ['object|null'],
    options: ['object']
  }],
  sass: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  collectAssets: ['object|null', {
    files: ['array|string']
  }],
  minifyJs: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  minifyHtml: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  cleanCss: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  minifyCss: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  sitemap: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  browserconfig: ['object|null', {
    tile70x70: ['string'],
    tile150x150: ['string'],
    tile310x150: ['string'],
    tile310x310: ['string'],
    tileColor: ['string']
  }],
  generateImages: ['array|null'],
  optimizeImages: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  revision: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  validateHtml: ['object|null', {
    files: ['array|string'],
    options: ['object']
  }],
  taskReport: ['boolean'],
  buildReport: ['boolean'],
  cleanBefore: ['array|string'],
  cleanAfter: ['array|string'],
  browsersync: ['object']
};

// Get project root path.
var projectRoot = __dirname;

// Mylly configuration file path (relative).
var configPath = '/mylly.config.js';

// Get mylly base configuration.
var baseCfg = getFileData(projectRoot + configPath);

// Build queue.
var buildQueue = Promise.resolve();

// Currently active Mylly instance.
var M;

// Mylly instance id
var MyllyId = 0;

//
// Mylly constructor
//

function Mylly(opts) {

  var inst = this;

  // Generate id for the instance.
  inst.id = ++MyllyId;

  // Sanitize options.
  opts = _.isPlainObject(opts) ? opts : _.isString(opts) ? getFileData(opts) : {};

  // Store configuration to instance.
  inst.config = sanitizeOptions(_.assign({}, baseCfg, opts));

  // Create Browsersync instance.
  inst.browsersync = browserSync.create();

  // Create Nunjucks instance.
  inst.nunjucks = nunjucks.configure(inst.config.srcPath, inst.config.templates ? inst.config.templates.options : {});

  // Create gulpRevAll instance.
  inst.rev = new gulpRevAll(inst.config.revision ? inst.config.revision.options : {});

  // Build task queue.
  inst.tasks = _.chain(taskQueue.slice(0))
  .filter(function (taskItem) {
    return _.reduce(taskItem.slice(1), function (result, cfgProp) {
      return result ? !!inst.config[cfgProp] : result;
    }, true);
  })
  .map(function (val) {
    return val[0];
  })
  .value();

}

Mylly.prototype._setup = function () {

  var inst = this;

  return new Promise(function (res) {

    // Clear file cache if build instance is changed.
    if (M !== inst) {
      gulpCache.caches = {};
    }

    // Setup build instance.
    M = inst;

    // Setup marked.
    if (inst.config.templates && inst.config.templates.markdown) {
      marked.setOptions(inst.config.templates.markdown);
      nunjucksMarkdown.register(inst.nunjucks, marked);
    }

    res(inst);

  });

};

Mylly.prototype.init = function () {

  var inst = this;

  return new Promise(function (resolve) {

    if (!pathExists(inst.config.srcPath)) {
      fs.copySync(projectRoot + '/src', inst.config.buildPath);
    }

    if (!pathExists(appRoot + configPath)) {
      fs.copySync(projectRoot + configPath, appRoot + configPath);
    }

    resolve(inst);

  });

};

Mylly.prototype.build = function () {

  var inst = this;

  return buildQueue = buildQueue.then(function () {
    return inst._setup();
  })
  .then(function () {
    return new Promise(function (resolve, reject) {
      gulpSequence('build')(function (err) {
        if (err) reject(err);
        resolve(inst);
      });
    });
  })
  .catch(function (err) {

    // Let's atomize the temporary distribution directory
    // if a build fails.
    if (pathExists(inst.config.buildPath)) {
      fs.removeSync(inst.config.buildPath);
    }

    return inst;

  });

};

Mylly.prototype.server = function () {

  var inst = this;

  return inst.build().then(function () {
    return new Promise(function (resolve) {
      inst.browsersync.init(inst.config.browsersync);
      gulp.watch(inst.config.srcPath + '/**/*', function () {
        inst.build().then(function () {
          inst.browsersync.reload();
        });
      });
      resolve(inst);
    });
  });

};

//
// Custom helpers
//

function sanitizeOptions(opts) {

  opts = _.assign({}, _.isPlainObject(opts) ? opts : {});

  validateOptionBranch(allowedConfigTypes, opts);

  return opts;

}

function validateOptionBranch(treeBranch, optsBranch) {

  _.forEach(treeBranch, function (val, key) {

    var
    optionValue = optsBranch[key],
    allowedValues = val[0],
    nestedRules = val[1];

    if (!typeCheck(optionValue, allowedValues)) {
      throw new TypeError('Configuration object error: cfg.' + key + ' type should be ' + allowedValues.split('|', ' or ').join() + ', but it is ' + typeOf(optionValue));
    }

    if (optionValue && typeOf(nestedRules, 'object')) {
      validateOptionBranch(nestedRules, optionValue);
    }

  });

}

function typeOf(value, isType) {

  var
  type = typeof value;

  type = type !== 'object' ? type : ({}).toString.call(value).split(' ')[1].replace(']', '').toLowerCase();

  return isType ? type === isType : type;

}

function typeCheck(value, types) {

  var
  ok = false,
  typesArray = types.split('|');

  _.forEach(typesArray, function (type) {

    ok = !ok ? typeOf(value, type) : ok;

  });

  return ok;

}

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

function getFileData(filePath) {

  return pathExists(filePath) ? require(filePath) : {};

}

function getTemplateData(file) {

  // Get the template context file path and data.
  var tplCtxPath = path.normalize(file.path).replace(/\.[^/.]+$/, M.config.templates.context);
  var tplCtxData = getFileData(tplCtxPath);

  return _.isFunction(tplCtxData) ? tplCtxData(_.assign({}, M.config.templates.data)) : _.assign({}, M.config.templates.data, tplCtxData);

}

function nunjucksRender(content) {

  var file = this.file;
  var data = getTemplateData(file);
  return M.nunjucks.render(path.relative(M.config.srcPath, file.path), data);

}

function minifyHtml(content) {

  return htmlMinifier(content, M.config.minifyHtml.options);

}

function gulpW3cjsReporter() {

  return through2.obj(function (file, enc, cb) {
    cb(null, file);
    if (file.w3cjs && !file.w3cjs.success) {
      gulpUtil.log('HTML validation error(s) found');
    }
  });

}

function logSkipTask(taskName, reason) {

  gulpUtil.log(gulpUtil.colors.yellow("Skipping"), "'" + gulpUtil.colors.cyan(taskName) + "'", gulpUtil.colors.red(reason));

}

function getNicePath(from, to) {

  return path.normalize(from + '/' + path.relative(from, to))

}

function fLog(filePath, action) {

  if (!M.config.taskReport) {
    return;
  }

  var msg;
  var color;

  if (action === 'edit') {
    msg = '>';
    color = 'yellow';
  }

  if (action === 'remove') {
    msg = 'x';
    color = 'red';
  }

  if (action === 'create') {
    msg = '+';
    color = 'green';
  }

  gulpUtil.log(msg, gulpUtil.colors[color](filePath));

}

function logFiles(rootPath, action, fileTypes) {

  return through2.obj(function (file, enc, cb) {
    if (M.config.taskReport) {
      var fileType = fileTypes ? path.extname(file.path) : false;
      var isCorrectFileType = fileTypes ? fileType && fileTypes.indexOf(fileType) > -1 : true;
      if (file.stat && file.stat.isFile() && isCorrectFileType) {
        fLog(getNicePath(rootPath || './', file.path), action)
      }
    }
    cb(null, file);
  });

}

//
// Tasks
//

// Lint JavaScript files.
gulp.task('pre-build:lint-js', function (cb) {

  return gulp
  .src(genSrc(M.config.srcPath, M.config.lintJs.files), {
    base: M.config.srcPath
  })
  .pipe(gulpCache(M.id + '-lint-js'))
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpEslint(M.config.lintJs.options))
  .pipe(gulpEslint.format())
  .pipe(gulpEslint.failAfterError());

});

// Lint SASS stylesheets.
gulp.task('pre-build:lint-sass', function (cb) {

  return gulp
  .src(genSrc(M.config.srcPath, M.config.lintSass.files), {
    base: M.config.srcPath
  })
  .pipe(gulpCache(M.id + '-lint-sass'))
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpSassLint(yamljs.load(M.config.lintSass.configPath)))
  .pipe(gulpSassLint.format())
  .pipe(gulpSassLint.failOnError());

});

// 1. Delete distribution and temporary distribution directories.
// 2. Clone the source directory as the distribution directory.
// 3. Remove "cleanBefore" files/directories.
gulp.task('build:setup', function () {

  fs.removeSync(M.config.buildPath);
  fs.copySync(M.config.srcPath, M.config.buildPath);

  return gulp
  .src(genSrc(M.config.buildPath, M.config.cleanBefore), {
    base: M.config.buildPath,
    read: false
  })
  .pipe(logFiles(M.config.buildPath, 'remove'))
  .pipe(vinylPaths(del));

});

// Compile Nunjucks templates.
gulp.task('build:templates', function (cb) {

  return gulp
  .src(genSrc(M.config.srcPath, M.config.templates.files), {
    base: M.config.srcPath
  })
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpChange(nunjucksRender))
  .pipe(gulp.dest(M.config.buildPath))
  .pipe(logFiles(M.config.buildPath, 'create'));

});

// Compile source directory's Sass stylesheets to distribution directory.
gulp.task('build:sass', function (cb) {

  return gulp
  .src(genSrc(M.config.srcPath, M.config.sass.files), {
    base: M.config.srcPath
  })
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpForeach(function (stream, file) {
    var sassOpts = M.config.sass.options;
    sassOpts.outFile = gulpUtil.replaceExtension(path.basename(file.path), 'css');
    return stream.pipe(gulpSass(sassOpts));
  }))
  .pipe(gulp.dest(M.config.buildPath))
  .pipe(logFiles(M.config.buildPath, 'create'));

});

// Generate concatenated scripts and styles from useref markers in HTML files
// within the distribution folder.
gulp.task('build:collect-assets', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.collectAssets.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUseref())
  .pipe(logFiles(M.config.buildPath, 'create', ['.js', '.css']))
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify all specified scripts in distribution folder.
gulp.task('build:minify-js', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyJs.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUglify(M.config.minifyJs.options))
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify all specified html files in distribution folder.
gulp.task('build:minify-html', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyHtml.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpChange(minifyHtml))
  .pipe(gulp.dest(M.config.buildPath));

});

// Remove unused styles from specified stylesheets.
gulp.task('build:clean-css', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.cleanCss.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUncss(M.config.cleanCss.options))
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify specified css files with cssnano.
gulp.task('build:minify-css', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyCss.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpCssnano())
  .pipe(gulp.dest(M.config.buildPath));

});

// Generate sitemap.xml based on the HTML files in distribution directory.
gulp.task('build:sitemap', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.sitemap.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpSitemap(M.config.sitemap.options))
  .pipe(gulp.dest(M.config.buildPath))
  .on('end', function () {
    fLog(getNicePath(M.config.buildPath, M.config.buildPath + '/sitemap.xml'), 'create');
  });

});

// Generate browserconfig.xml.
gulp.task('build:browserconfig', function (cb) {

  var data = js2xmlparser('browserconfig', {
    'msapplication': {
      'tile': {
        'square70x70logo': {'@': {'src': M.config.browserconfig.tile70x70}},
        'square150x150logo': {'@': {'src': M.config.browserconfig.tile150x150}},
        'square310x150logo': {'@': {'src': M.config.browserconfig.tile310x150}},
        'square310x310logo': {'@': {'src': M.config.browserconfig.tile310x310}},
        'TileColor': M.config.browserconfig.tileColor
      }
    }
  });

  fs.writeFile(M.config.buildPath + '/browserconfig.xml', data, function (err) {
    if (err) cb(err);
    fLog(getNicePath(M.config.buildPath, M.config.buildPath + '/browserconfig.xml'), 'create');
    cb();
  });

});

// Generate new images with Jimp.
gulp.task('build:generate-images', function () {

  var ret = Promise.resolve();
  var sets = (M.config.generateImages || []);

  sets.forEach(function (set) {

    ret = ret.then(function () {

      return new Promise(function (resolve, reject) {

        var sourcePath = path.normalize(M.config.buildPath + set.source);
        fLog(sourcePath, 'edit');

        set.sizes.forEach(function (size) {

          var targetPath = path.normalize(M.config.buildPath + set.target.replace('{{ width }}', size[0]).replace('{{ height }}', size[1]));

          if (!pathExists(targetPath)) {

            jimp.read(sourcePath, function (err, img) {

              if (err) { reject(err); }

              img
              .resize(size[0], size[1])
              .write(targetPath, function (err, val) {
                if (err) { reject(err); }
                fLog(targetPath, 'create');
                resolve(val);
              });

            });

          }

        });


      });

    });

  });

  return ret;

});

// Optimize images with imagemin.
gulp.task('build:optimize-images', function (cb) {

  return gulp
  .src(genSrc(M.config.buildPath, M.config.optimizeImages.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpImagemin(M.config.optimizeImages.options))
  .pipe(gulp.dest(M.config.buildPath));

});

// Revision files and references.
gulp.task('build:revision', function () {

  var origFilePaths = [];
  var newFilePaths = [];

  return gulp
  .src(genSrc(M.config.buildPath, M.config.revision.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpChange(function (content) {
    var filePath = path.normalize(this.file.path);
    origFilePaths.push(filePath);
    return content;
  }))
  .pipe(M.rev.revision())
  .pipe(gulpChange(function (content) {
    var filePath = path.normalize(this.file.path);
    newFilePaths.push(filePath);
    if (origFilePaths.indexOf(filePath) === -1) {
      fLog(getNicePath(M.config.buildPath || './', filePath), 'create');
    }
    return content;
  }))
  .pipe(gulp.dest(M.config.buildPath))
  .on('end', function () {

    var junkFiles = [];
    _.forEach(origFilePaths, function (origFilePath, i) {
      if (origFilePath !== newFilePaths[i]) {
        var formattedPath = '/' + path.relative(M.config.buildPath, origFilePath).split(path.sep).join('/');
        junkFiles.push(formattedPath);
        fLog(getNicePath(M.config.buildPath || './', origFilePath), 'remove');
      }
    });

    del.sync(genSrc(M.config.buildPath, junkFiles), {force: true});

  });

});

// 1. Atomize distribution directory if it exists.
// 2. Rename temporary directory (if it exists) to distribution directory.
// 3. Atomize all unwanted files/directories.
gulp.task('build:clean', function (cb) {

  if (pathExists(M.config.distPath)) {
    fs.removeSync(M.config.distPath);
  }

  if (pathExists(M.config.buildPath)) {
    fs.renameSync(M.config.buildPath, M.config.distPath);
  }

  return gulp
  .src(genSrc(M.config.distPath, M.config.cleanAfter), {
    base: M.config.distPath,
    read: false
  })
  .pipe(logFiles(M.config.distPath, 'remove'))
  .pipe(vinylPaths(del));

});

// Validate HTML markup against W3C standards.
gulp.task('post-build:validate-html', function (cb) {

  isOnline(function (err, online) {
    if (err) {
      cb(err);
    }
    else if (!online) {
      logSkipTask('post-build:validate-html', 'No Internet connection');
      cb();
    }
    else {
      gulpSequence('post-build:validate-html-run')(cb);
    }
  });

});

// Validate HTML markup against W3C standards.
gulp.task('post-build:validate-html-run', function () {

  return gulp
  .src(genSrc(M.config.distPath, M.config.validateHtml.files), {
    base: M.config.distPath
  })
  .pipe(logFiles(M.config.distPath, 'edit'))
  .pipe(gulpW3cjs())
  .pipe(gulpW3cjsReporter());

});

gulp.task('post-build:report', function () {

  var report = {
    totalSize: 0,
    totalAmount: 0,
    files: {}
  };

  return gulp
  .src(genSrc(M.config.distPath, '/**/*'), {
    base: M.config.distPath
  })
  .pipe(through2.obj(function (file, enc, cb) {
    if (file.stat.isFile()) {
      var filePath = path.relative(M.config.distPath, file.path);
      var fileSize = file.stat.size;
      var fileType = path.extname(file.path);
      report.totalSize += fileSize;
      report.totalAmount += 1;
      report.files[fileType] = report.files[fileType] || [];
      report.files[fileType].push({
        path: filePath,
        size: fileSize
      });
    }
    cb(null, file);
  }))
  .on('end', function () {

    gulpUtil.log('');
    gulpUtil.log('Build report');
    gulpUtil.log(gulpUtil.colors.gray('------------'));
    gulpUtil.log('');
    gulpUtil.log('A total of ' + gulpUtil.colors.cyan(report.totalAmount) + ' files weighing ' + gulpUtil.colors.magenta(filesize(report.totalSize, {round: 0})) + ' were generated.');
    gulpUtil.log('');

    _.forEach(report.files, function (fileTypeData, fileType) {

      var fileTypeSize = filesize(_.reduce(fileTypeData, function (total, val) {
        return total + val.size;
      }, 0), {round: 0});

      gulpUtil.log(gulpUtil.colors.green(fileType), gulpUtil.colors.cyan(fileTypeData.length), gulpUtil.colors.magenta(fileTypeSize));

      _.forEach(fileTypeData, function (fileData) {
        gulpUtil.log('  ' + fileData.path, gulpUtil.colors.magenta(filesize(fileData.size, {round: 0})));
      });

    });

    gulpUtil.log('');

  });

});

// Build the distribution directory from the source files.
gulp.task('build', function (cb) {

  gulpSequence.apply(null, M.tasks)(cb);

});

// Development test task that creates a new Mylly instance and runs build.
gulp.task('default', function () {

  return (new Mylly()).build();

});

// Development test task that creates a new Mylly instance and runs server.
gulp.task('server', function () {

  return (new Mylly()).server();

});

//
// Exports
//

module.exports = function (opts) {

  return new Mylly(opts);

};
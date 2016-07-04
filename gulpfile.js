/*
v0.2.0
======
  * No config setup - automatically detect what is needed.
  * Integrate mylly.config.js into gulpfile.js
  * Handle parallel builds
  * Minimum number of dependencies.
  * Docs.

  var myllyDev = require('mylly')(true);
  var myllyProd = require('mylly')(false);

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
var yamljs = require('yamljs');
var through2 = require('through2');
var vinylPaths = require('vinyl-paths');
var isOnline = require('is-online');
var filesize = require('filesize');
var notifier = require('node-notifier');
var deleteEmpty = require('delete-empty');
var browserSync = require('browser-sync');
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
  ['lint:js', 'lintJs'],
  ['lint:sass', 'lintSass'],
  ['build:setup'],
  ['build:templates', 'templates'],
  ['build:sass', 'sass'],
  ['build:collect-assets', 'collectAssets'],
  ['build:minify-js', 'minifyJs'],
  ['build:minify-html', 'minifyHtml'],
  ['build:clean-css', 'cleanCss'],
  ['build:minify-css', 'minifyCss'],
  ['build:sitemap', 'sitemap'],
  ['build:generate-images', 'generateImages'],
  ['build:optimize-images', 'optimizeImages'],
  ['build:revision', 'revision'],
  ['build:clean'],
  ['aftermath:validate-html', 'validateHtml'],
  ['aftermath:report', 'buildReport']
];

// Currently active Mylly instance and related promise.
var M;

//
// Mylly constructor
//

function Mylly(isDev, rootPath) {

  var inst = this;

  // Sanitize rootpath.
  rootPath = typeof rootPath === 'string' ? rootPath : '.';

  // Store root path.
  inst.rootPath = rootPath;

  // Store configuration to instance.
  inst.config = _.assign({}, getFileData(__dirname + '/mylly.config.js')(isDev, rootPath));

  // Create Nunjucks instance.
  inst.nunjucks = nunjucks.configure(inst.config.srcPath, inst.config.templates ? inst.config.templates.options : {});

  // Create gulpRevAll instance.
  inst.rev = new gulpRevAll(inst.config.revision ? inst.config.revision.options : {});

  // Create browserSync instance.
  inst.browsersync = browserSync.create();

  // Build error indicator.
  inst.buildError = undefined;

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

Mylly.prototype.build = function () {

  var inst = this;

  // Let's notify that build started.
  notify('Build started');

  // Reset build error.
  inst.buildError = undefined;

  return new Promise(function (resolve, reject) {

    // Clear file cache if build instance is changed.
    if (M !== inst) {
      gulpCache.caches = {};
    }

    // Setup build instance.
    M = inst;

    // Setup nunjucks.
    if (inst.config.templates && inst.config.templates.markdown) {
      marked.setOptions(inst.config.templates.markdown);
      nunjucksMarkdown.register(inst.nunjucks, marked);
    }

    // Run build.
    gulpSequence('build')(function () {
      if (inst.buildError) {
        reject(inst.buildError);
      }
      else {
        resolve(inst);
      }
    });

  })
  .then(function (val) {

    // Nice, build finished without a hitch.
    notify('Build completed');
    return val;

  })
  .catch(function (err) {

    // Darn, build failed. Let's make some noise.
    notify('Build failed');
    gulpUtil.log(err);

    // And reset the build error, for good measure.
    inst.buildError = undefined;

    // Also, let's delete the temporary build folder.
    if (pathExists(inst.config.buildPath)) {
      fs.removeSync(inst.config.buildPath);
    }

  });

};

Mylly.prototype.server = function () {

  var inst = this;

  return inst
  .build()
  .then(function () {
    return new Promise(function (resolve) {
      inst.browsersync.init(inst.config.browsersync, function () {
        notify('Server started');
        resolve(inst);
      });
    });
  })
  .then(function () {
    return new Promise(function (resolve) {
      var isBuilding = false;
      gulp.watch(inst.config.srcPath + '/**/*', function () {
        if (!isBuilding) {
          isBuilding = true;
          inst.build().then(function () {
            isBuilding = false;
            inst.browsersync.reload();
          });
        }
      });
      notify('Started watching files');
      resolve(inst);
    });
  })
  .catch(function (err) {
    notify('Server failed');
    gulpUtil.log(err);
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

function forceRequire(filePath) {

  delete require.cache[path.resolve(filePath)];
  return require(filePath);

}

function getFileData(filePath) {

  return pathExists(filePath) ? forceRequire(filePath) : {};

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
        fLog(getNicePath(rootPath, file.path), action)
      }
    }
    cb(null, file);
  });

}

function notify(msg) {

  notifier.notify({
    title: 'Mylly',
    message: msg,
    sound: true,
    wait: false
  });

}

function handlePipeError(err) {

  gulpUtil.log(gulpUtil.color(err));
  this.emit('end');

}

//
// Tasks
//

// Lint JavaScript files.
gulp.task('lint:js', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.srcPath, M.config.lintJs.files), {
    base: M.config.srcPath
  })
  .pipe(gulpCache(M.id + '-lint-js'))
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpEslint(M.config.lintJs.options))
  .on('error', handlePipeError)
  .pipe(gulpEslint.format())
  .on('error', handlePipeError)
  .pipe(gulpEslint.failAfterError())
  .on('error', handlePipeError);

});

// Lint SASS stylesheets.
gulp.task('lint:sass', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.srcPath, M.config.lintSass.files), {
    base: M.config.srcPath
  })
  .pipe(gulpCache(M.id + '-lint-sass'))
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpSassLint(yamljs.load(M.config.lintSass.configPath)))
  .on('error', handlePipeError)
  .pipe(gulpSassLint.format())
  .on('error', handlePipeError)
  .pipe(gulpSassLint.failOnError())
  .on('error', handlePipeError);

});

// 1. Delete distribution and temporary distribution directories.
// 2. Clone the source directory as the distribution directory.
// 3. Remove "cleanBefore" files/directories.
gulp.task('build:setup', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  if (pathExists(M.config.buildPath)) {
    fs.removeSync(M.config.buildPath);
  }
  fs.copySync(M.config.srcPath, M.config.buildPath);

  if (M.config.cleanBefore) {
    return gulp
    .src(genSrc(M.config.buildPath, M.config.cleanBefore), {
      base: M.config.buildPath,
      read: false
    })
    .pipe(logFiles(M.config.buildPath, 'remove'))
    .pipe(vinylPaths(del));
  }
  else {
    cb();
  }

});

// Compile Nunjucks templates.
gulp.task('build:templates', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.srcPath, M.config.templates.files), {
    base: M.config.srcPath
  })
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpChange(nunjucksRender))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath))
  .pipe(logFiles(M.config.buildPath, 'create'));

});

// Compile source directory's Sass stylesheets to distribution directory.
gulp.task('build:sass', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.srcPath, M.config.sass.files), {
    base: M.config.srcPath
  })
  .pipe(logFiles(M.config.srcPath, 'edit'))
  .pipe(gulpForeach(function (stream, file) {
    var sassOpts = M.config.sass.options;
    sassOpts.outFile = gulpUtil.replaceExtension(path.basename(file.path), 'css');
    return stream.pipe(gulpSass(sassOpts)).on('error', handlePipeError);
  }))
  .pipe(gulp.dest(M.config.buildPath))
  .pipe(logFiles(M.config.buildPath, 'create'));

});

// Generate concatenated scripts and styles from useref markers in HTML files
// within the distribution folder.
gulp.task('build:collect-assets', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.collectAssets.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUseref())
  .on('error', handlePipeError)
  .pipe(logFiles(M.config.buildPath, 'create', ['.js', '.css']))
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify all specified scripts in distribution folder.
gulp.task('build:minify-js', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyJs.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUglify(M.config.minifyJs.options))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify all specified html files in distribution folder.
gulp.task('build:minify-html', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyHtml.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpChange(minifyHtml))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath));

});

// Remove unused styles from specified stylesheets.
gulp.task('build:clean-css', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.cleanCss.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpUncss(M.config.cleanCss.options))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath));

});

// Minify specified css files with cssnano.
gulp.task('build:minify-css', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.minifyCss.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpCssnano())
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath));

});

// Generate sitemap.xml based on the HTML files in distribution directory.
gulp.task('build:sitemap', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.sitemap.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpSitemap(M.config.sitemap.options))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath))
  .on('end', function () {
    fLog(getNicePath(M.config.buildPath, M.config.buildPath + '/sitemap.xml'), 'create');
  });

});

// Generate new images with Jimp.
gulp.task('build:generate-images', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

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

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.buildPath, M.config.optimizeImages.files), {
    base: M.config.buildPath
  })
  .pipe(logFiles(M.config.buildPath, 'edit'))
  .pipe(gulpImagemin(M.config.optimizeImages.options))
  .on('error', handlePipeError)
  .pipe(gulp.dest(M.config.buildPath));

});

// Revision files and references.
gulp.task('build:revision', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

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
      fLog(getNicePath(M.config.buildPath || M.rootPath, filePath), 'create');
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
        fLog(getNicePath(M.config.buildPath || M.rootPath, origFilePath), 'remove');
      }
    });

    del.sync(genSrc(M.config.buildPath, junkFiles), {force: true});

  });

});

// 1. Atomize distribution directory if it exists.
// 2. Rename temporary directory (if it exists) to distribution directory.
// 3. Atomize all unwanted files/directories.
gulp.task('build:clean', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  if (!pathExists(M.config.buildPath)) {
    cb();
  }

  if (pathExists(M.config.distPath)) {
    fs.removeSync(M.config.distPath);
  }

  fs.renameSync(M.config.buildPath, M.config.distPath);

  if (M.config.cleanAfter) {
    return gulp
    .src(genSrc(M.config.distPath, M.config.cleanAfter), {
      base: M.config.distPath,
      read: false
    })
    .pipe(logFiles(M.config.distPath, 'remove'))
    .pipe(vinylPaths(del))
    .on('end', function () {
      deleteEmpty.sync(M.config.distPath + '/');
    });
  }
  else {
    deleteEmpty.sync(M.config.distPath + '/');
    cb();
  }

});

// Validate HTML markup against W3C standards.
gulp.task('aftermath:validate-html', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  isOnline(function (err, online) {
    if (err) {
      cb(err);
    }
    else if (!online) {
      logSkipTask('aftermath:validate-html', 'No Internet connection');
      cb();
    }
    else {
      gulpSequence('aftermath:validate-html-run')(cb);
    }
  });

});

// Validate HTML markup against W3C standards.
gulp.task('aftermath:validate-html-run', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

  return gulp
  .src(genSrc(M.config.distPath, M.config.validateHtml.files), {
    base: M.config.distPath
  })
  .pipe(logFiles(M.config.distPath, 'edit'))
  .pipe(gulpW3cjs())
  .pipe(gulpW3cjsReporter());

});

gulp.task('aftermath:report', function (cb) {

  if (M.buildError) {
    cb();
    return;
  }

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

// Development test task that creates a new Mylly production instance and runs build.
gulp.task('test:build', function () {

  return (new Mylly()).build();

});

// Development test task that creates a new Mylly development instance and runs build.
gulp.task('test:build:dev', function () {

  return (new Mylly(true)).build();

});

// Development test task that creates a new Mylly production instance and runs server.
gulp.task('test:server', function () {

  return (new Mylly()).server();

});

// Development test task that creates a new Mylly development instance and runs server.
gulp.task('test:server:dev', function () {

  return (new Mylly(true)).server();

});

//
// Exports
//

module.exports = function (isDev, rootPath) {

  return new Mylly(isDev, rootPath);

};
module.exports = function (isDev, rootPath) {

  // Define directory paths.
  var srcPath = rootPath + '/src';
  var buildPath = rootPath + '/build';
  var distPath = rootPath + '/dist';

  // Get source configuration data.
  var srcConfig = require(srcPath + '/config.js');

  // Define Nunjucks template context identifier.
  var tplDataExtension = '.json';

  // The configuration data object.
  var config = {};

  // Path to the source directory.
  // @type {String}
  config.srcPath = srcPath;

  // Path to the build directory.
  // @type {String}
  config.buildPath = buildPath;

  // Path to the distribution directory.
  // @type {String}
  config.distPath = distPath;

  // JavaScript linting configuration using ESLint. Set to null to disable.
  // @type {Object|Null}
  config.lintJs = {
    // Define the JavaScript files you want to lint. The paths are relative to
    // srcPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: srcConfig.path.scripts + '/*.js',
    // ESLint configuration.
    // https://github.com/adametry/gulp-eslint/blob/master/example/config.js
    // https://mozilla.github.io/nunjucks/api.html#configure
    // @type {Object|String}
    options: {
      config: srcPath + '/.eslintrc'
    }
  };

  // Sass linting configuration. Set to null to disable.
  // @type {Object|Null}
  config.lintSass = {
    // Define the files you want to lint. The paths are relative to srcPath.
    // @type {Array|String}
    files: srcConfig.path.styles + '/*.s+(a|c)ss',
    // Path to SASS linter configuration file.
    // https://github.com/sasstools/sass-lint/blob/master/docs/sass-lint.yml
    // @type {String}
    configPath: srcPath + '/sass-lint.yml'
  };

  // Templates configuration. Set to null to disable.
  // @type {Object|Null}
  config.templates = {
    // Define the files you want Nunjucks to process. The paths are relative to
    // srcPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: '/**/[^_]*.html',
    // This string is used for identifying template context files. .json and .js
    // file formats are supported.
    // @type {String}
    context: tplDataExtension,
    // Core template data which is provided for all templates as context data.
    // Template specific data (if any) is merged with this data. If the core and
    // template data have identically named properties the template data is
    // preferred.
    // @type {Object|Null}
    data: srcConfig,
    // Nunjucks marked configuration. Set to null to disable.
    // https://github.com/chjj/marked#options-1
    // @type {Object|Null}
    markdown: {},
    // Nunjucks options.
    // https://mozilla.github.io/nunjucks/api.html#configure
    // @type {Object}
    options: {
      autoescape: true,
      noCache: true,
      watch: false
    }
  };

  // Sass configuration. Set to null to disable.
  // @type {Object|Null}
  config.sass = {
    // Define the Sass files you want to compile. The paths are relative to srcPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: '/**/[^_]**.s+(a|c)ss',
    // SASS options.
    // https://github.com/sass/node-sass#options
    // @type {Object}
    options : {
      outputStyle: isDev ? 'expanded' : 'compressed'
    }
  };

  // Collect marked styles and and scripts within specified HTML files. Set to null to disable.
  // https://www.npmjs.com/package/gulp-useref#usage
  // @type {Object|Null}
  config.collectAssets = isDev ? null : {
    // Define the HTML files you want to process for concatenation markers. The paths are relative to
    // buildPath.
    // @type {Array|String}
    files: ['/**/*.html']
  };

  // JavaScript minification configuration. Set to null to disable.
  // @type {Object|Null}
  config.minifyJs = isDev ? null : {
    // Define the JavaScript files you want to minify. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: srcConfig.path.scripts + '/**/[dist.]*.js',
    // Uglify options.
    // https://www.npmjs.com/package/gulp-uglify#options
    // @type {Object}
    options: {}
  };

  // HTML minification configuration. Set to null to disable.
  // @type {Object|Null}
  config.minifyHtml = isDev ? null : {
    // Define the HTML files you want to minify. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: ['/**/*.html'],
    // HTML minifier options.
    // https://www.npmjs.com/package/html-minifier#options-quick-reference
    // @type {Object}
    options: {
      collapseWhitespace: true
    }
  };

  // Remove unused styles. Set null to disable.
  // @type {Object|Null}
  config.cleanCss = isDev ? null : {
    // Define the CSS files you want to process. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: '/**/[dist.]*.css',
    // Uncss options.
    // https://github.com/ben-eb/gulp-uncss#options
    // @type {Object}
    options: {
      html: [buildPath + '/**/*.html'],
      ignore: []
    }
  };

  // Minify styles. Set null to disable.
  // @type {Object|Null}
  config.minifyCss = isDev ? null : {
    // Define the CSS files you want to process. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: '/**/[dist.]*.css',
    // cssnano options.
    // http://cssnano.co/options/
    // @type {Object}
    options: {}
  };

  // Auto-generate sitemap.xml. Set null to disable.
  // @type {Object|Null}
  config.sitemap = {
    // Define the files you want to include in the sitemap. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: ['/**/*.html'],
    // Sitemap generator options.
    // https://www.npmjs.com/package/gulp-sitemap#options
    // @type {Object}
    options: {
      siteUrl: srcConfig.site.url,
      spacing: '  '
    }
  };

  // Image generator configuration. Provide an array of configuration objects to generate resized
  // versions of an image. Set to null to disable.
  // @type {Array|Null}
  config.generateImages = [{
    source: srcConfig.path.images + '/templates/icon.png',
    sizes: [[310, 310], [192, 192], [180, 180], [150, 150], [152, 152], [144, 144], [120, 120], [114, 114], [76, 76], [72, 72], [70, 70], [57, 57], [16, 16]],
    target: srcConfig.path.images + '/icon-{{ width }}x{{ height }}.png'
  }];

  // Image optimization configuration. Set to null to disable.
  // @type {Object|Null}
  config.optimizeImages = {
    // Define the image files you want to optimize. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: '/**/*.{jpg,png,gif,svg}',
    // Imagemin options.
    // https://github.com/sindresorhus/gulp-imagemin
    // @type {Object}
    options: {}
  };

  // Revisioning configuration. Set to null to disable.
  // @type {Object|Null}
  config.revision = {
    // Define the files you want the revision system to process. The paths are relative to buildPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: [
      '/**/*',
      '!' + srcConfig.path.styles + '/**/*.s+(a|c)ss'
    ],
    // Revision system options.
    // https://github.com/smysnk/gulp-rev-all
    // @type {Object}
    options: {
      dontRenameFile: ['.html', '.xml', '.json', '.txt']
    }
  };

  // HTML validator configuration. Set to null to disable.
  // @type {Object|Null}
  config.validateHtml = {
    // Define the HTML files you want to validate. The paths are relative to distPath.
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
    // @type {Array|String}
    files: ['/**/*.html'],
    // HTML validator options.
    // https://www.npmjs.com/package/gulp-w3cjs#w3cjs-options
    // @type {Object}
    options: {}
  };

  // Show task reports.
  // @type {Boolean}
  config.taskReport = true;

  // Show build report.
  // @type {Boolean}
  config.buildReport = true;

  // The build process starts with atomizing the distribution directory after which the source
  // directory is cloned as the base for the distribution directory. This settings allows you to
  // define files and directories which should be removed from the distribution directory before the
  // build process starts. All the paths are relative to the distribution directory.
  // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
  // @type {Array|String|Null}
  config.cleanBefore = [
    // Clean template files and their context files.
    '/**/*.html',
    '/**/*' + tplDataExtension,
    // Clean config files.
    '/config.js',
    '/.eslintrc',
    '/sass-lint.yml'
  ];

  // This settings allows you to define which files and folders to remove after the build process.
  // All the paths are relative to the distribution directory.
  // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
  // @type {Array|String|Null}
  config.cleanAfter = [
    // Clean all image templates.
    srcConfig.path.images + '/templates',
    // Clean all sass files.
    srcConfig.path.styles + '/**/*.s+(a|c)ss'
  ];

  if (!isDev) {
    // Clean all source scripts.
   config.cleanAfter.push(srcConfig.path.scripts + '/**/[^dist.]*.js');
    // Clean all non distribution css files
   config.cleanAfter.push(srcConfig.path.styles + '/**/[^dist.]*.css');
  }

  // BrowserSync configuration.
  // http://www.browsersync.io/docs/options/
  // @type {Object}
  config.browsersync = {
    server: {
      baseDir: distPath
    },
    reloadOnRestart: true,
    injectChanges: false
  };

  return config;

};
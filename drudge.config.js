var config = {};

// Path to the build directory.
// @type {String}
config.buildPath = './build';

// Path to the distribution directory.
// @type {String}
config.distPath = './dist';

// Nunjucks configuration.
// https://mozilla.github.io/nunjucks/api.html#configure
// @type {Object}
config.nunjucks = {
  autoescape: true
};

// Marked configuration.
// https://github.com/chjj/marked#options-1
// @type {Object}
config.marked = {};

// SASS configuration. Set to null to disable.
// https://github.com/sass/node-sass#options
// @type {Object|Null}
config.sass = {
  outputStyle: 'compressed'
};

// Set to true to validate all JavaScript files for syntax errors in the build directory.
// @type {Boolean}
config.validateJs = true;

// HTML validator configuration. Set to null to disable.
// https://www.npmjs.com/package/gulp-w3cjs#w3cjs-options
// @type {Object|Null}
config.w3cjs = {};

// JSCS configuration. Set to null to disable.
// @type {Object|Null}
config.jscs = {
  // Define the files you want JSCS to validate. The paths are relative to buildPath.
  // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
  // @type {Array|String}
  files: '/static/scripts/*.js',
  // Path to the .jscsrc configuration file.
  // @type {String}
  configPath: config.buildPath + '/.jscsrc'
};

// Uglify configuration. Set to null to disable.
// https://www.npmjs.com/package/gulp-uglify#options
// @type {Object|Null}
config.uglify = {};

// HTML minifier configuration. Set to null to disable.
// https://www.npmjs.com/package/html-minifier#options-quick-reference
// @type {Object|Null}
config.htmlMinifier = {
  collapseWhitespace: true
};

// Image generator configuration. Provide an array of configuration objects to generate resized
// versions of an image. Set to null to disable.
// @type {Array|Null}
config.generateImages = [
  {
    source: '/static/images/templates/icon.png',
    sizes: [[192, 192], [180, 180], [152, 152], [144, 144], [120, 120], [114, 114], [76, 76], [72, 72], [57, 57]],
    target: '/static/images/icon-{{ width }}x{{ height }}.png'
  },
  {
    source: '/static/images/templates/tile.png',
    sizes: [[310, 310], [150, 150], [70, 70]],
    target: '/static/images/tile-{{ width }}x{{ height }}.png'
  },
  {
    source: '/static/images/templates/tile-wide.png',
    sizes: [[310, 150]],
    target: '/static/images/tile-{{ width }}x{{ height }}.png'
  }
];

// Imagemin configuration. Set to null to disable.
// @type {Object|Null}
config.imagemin = {
  // Define the files you want Imagemin to process. The paths are relative to distPath.
  // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
  // @type {Array|String}
  files: ['/**/*.png', '/**/*.jpg', '/**/*.gif', '/**/*.svg'],
  // Imagemin plugin options.
  // https://github.com/sindresorhus/gulp-imagemin
  // @type {Object}
  options: {}
};

// Revisioning configuration. Set to null to disable.
// https://github.com/smysnk/gulp-rev-all
// @type {Object|Null}
config.rev = {
  dontRenameFile: ['.html', '.xml', '.json'],
  annotator: function(contents, path) {
    var fragments = [{'contents': contents}];
    return fragments;
  },
  replacer: function(fragment, replaceRegExp, newReference, referencedFile) {
    if (referencedFile.revFilenameExtOriginal === '.js' && !newReference.match(/\.js$/)){
      return;
    }
    fragment.contents = fragment.contents.replace(replaceRegExp, '$1' + newReference + '$3$4');
  }
};

// BrowserSync configuration.
// http://www.browsersync.io/docs/options/
// @type {Object}
config.browserSync = {
  server: {
    baseDir: config.distPath
  },
  reloadOnRestart: true,
  injectChanges: false
};

// The build process starts with atomizing the distribution directory after which the build
// directory is cloned as the base for the distribution folder. With this setting you can define
// which files/folders should be deleted from the distribution folder right after the clone process.
// Note that there are some enforced defaults which are needed to make the build process work. All
// the paths are relative to the distribution folder.
// https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
// @type {Array|String}
config.ignore = [
  '/static/images/templates',
  '/static/scripts/**/*',
  '/static/styles/**/*',
  '/.jscsrc'
];

// Core template data which is provided for all templates as context data. Template specific data
// (if any) is merged with this data.
// @type {Object|Null}
config.templateData = {
  siteUrl: '',
  siteName: 'My website',
  siteDescription: 'My website description',
  siteAuthor: '',
  googleAnalyticsUa: '',
  staticPath: '/static',
  stylesPath: '/static/styles',
  scriptsPath: '/static/scripts',
  imagesPath: '/static/images'
};

module.exports = config;
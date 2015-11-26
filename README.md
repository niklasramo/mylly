# drudge

A simple (and opinionated) static site generator for Node.js.

**Features**

* Compiles [Nunjucks](https://mozilla.github.io/nunjucks/) templates to static minified HTML files. Data can be provided for individual templates with JSON and/or JavaScript files using a special naming convention.
* Parses and compile markdown in Nunjucks templates.
* Validates compiled HTML files for syntax errors.
* Compiles [Sass](http://sass-lang.com/) stylesheets to static CSS files.
* Concatenates and minifies JavaScript files.
* Validates JavaScript files for syntax errors.
* Resizes images and optimizes images.
* JavaScript code style validation with [jscs](http://jscs.info/).
* SASS code style validation.
* Removes unused CSS styles.
* Revisions files.
* Integrates with BrowserSync.

**Coming up...**

* Automated SEO analysis.
* Improved page speed optimizations: http://yeoman.io/blog/performance-optimization.html
* PageSpeed Insights with reporting (https://github.com/addyosmani/psi).
* Smart revisioning: revision only files which have changed and keep the data from last build stored somewhere.
* Pluggable. Users should be able to extend Drudge's functionality.
* Build report which contains possible warnings, file sizes / project size.
* Orchestrated release flow (a new `deploy` method), which
  * Bumps the project version.
  * Updates/generates chagelog.
  * Tests changes with CI tool of choice.
  * Commits, tags and pushes changes to github/bitbucket.
  * Uploads changes to production server with ftp (https://github.com/morris/vinyl-ftp). This is a bonus feature since in many occasions this is a bad idea. This should actually have it's own method.
* Tests.

**Install**

`npm install drudge --save-dev`

**Usage**

```javascript
var drudge = require('drudge');

// Create initial source directory and drudge configuration file.
drudge.init();

// Build the dist directory.
drudge.build();

// Start up a local development server.
drudge.server();
```

**Configuration**

Drudge allows you to configure a lot of things via the `drudge.config.js` file. When you call `drudge.init()` the default config file is imported to your project's root. You can modify the file as you wish for your project. Below is the default configuration with some explanations.

```javascript
var config = {};

// Path to the source directory.
// @type {String}
config.srcPath = './src';

// Path to the distribution directory.
// @type {String}
config.distPath = './dist';

// Core template data which is provided for all templates as context data. Template specific data
// (if any) is merged with this data.
// @type {Object|Null}
config.templateData = {
  siteUrl: 'http://mywebsite.com',
  siteName: 'My website',
  siteDescription: 'My website description',
  siteAuthor: '',
  googleAnalyticsUa: '',
  staticPath: '/static',
  stylesPath: '/static/styles',
  scriptsPath: '/static/scripts',
  imagesPath: '/static/images'
};

// SASS linter configuration. Set to null to disable.
// @type {Object|Null}
config.sassLint = {
  // Define the files you want SASS linter to validate. The paths are relative to srcPath.
  // @type {Array|String}
  files: '/static/styles/*.s+(a|c)ss',
  // Path to SASS linter configuration file.
  // https://github.com/sasstools/sass-lint/blob/master/docs/sass-lint.yml
  // @type {String}
  configPath: config.srcPath + '/sass-lint.yml'
};

// Set to true to validate all JavaScript files for syntax errors in the source directory.
// @type {Boolean}
config.validateJs = true;

// JSCS configuration. Set to null to disable.
// @type {Object|Null}
config.jscs = {
  // Define the files you want JSCS to validate. The paths are relative to srcPath.
  // https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
  // @type {Array|String}
  files: '/static/scripts/*.js',
  // Path to the .jscsrc configuration file.
  // @type {String}
  configPath: config.srcPath + '/.jscsrc'
};

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
  files: '/**/*.{jpg,png,gif,svg}',
  // Imagemin plugin options.
  // https://github.com/sindresorhus/gulp-imagemin
  // @type {Object}
  options: {}
};

// Auto-generate sitemap.xml. Set null to disable.
//https://www.npmjs.com/package/gulp-sitemap#options
// @type {Object|Null}
config.sitemap = {
  siteUrl: config.templateData.siteUrl,
  spacing: '  '
};

// Remove unused styles. Set null to disable.
// https://github.com/ben-eb/gulp-uncss#options
// @type {Object|Null}
config.uncss = {
  html: [config.distPath + '/**/*.html'],
  ignore: []
};

// Revisioning configuration. Set to null to disable.
// https://github.com/smysnk/gulp-rev-all
// @type {Object|Null}
config.rev = {
  dontRenameFile: ['.html', '.xml', '.json', '.txt'],
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

// HTML validator configuration. Set to null to disable.
// https://www.npmjs.com/package/gulp-w3cjs#w3cjs-options
// @type {Object|Null}
config.w3cjs = {};

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

// The build process starts with atomizing the distribution directory after which the source
// directory is cloned as the base for the distribution directory. With this setting you can define
// which files/folders should be deleted from the distribution directory right after the clone
// process. Note that there are some enforced defaults which are needed to make the build process
// work. All the paths are relative to the distribution directory.
// https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options
// @type {Array|String}
config.ignore = [
  '/static/images/templates',
  '/static/scripts/**/*',
  '/static/styles/**/*',
  '/.jscsrc',
  '/sass-lint.yml'
];

module.exports = config;
```

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
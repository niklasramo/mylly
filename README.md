# mylly

Mylly (finnish for *mill*) is an opinionated static site generator using specific set of Node modules to automate tedious and repetitive tasks.

##Install

`npm install mylly --save-dev`

##Features

* Compiles [Nunjucks](https://mozilla.github.io/nunjucks/) templates.
* Compiles markdown.
* Validates HTML files according to W3C standards.
* Lints and compiles [Sass](http://sass-lang.com/) stylesheets.
* Removes unused CSS styles.
* Concatenates, minifies and lints JavaScript files.
* Resizes images and optimizes images.
* Generates browserconfig.xml.
* Generates sitemap.xml.
* Revisions files.
* BrowserSync development server.
* Build report.

## Upcoming features

* Compile ES6/ES7 code to ES5 using Babel.
* CSS and JS sourcemaps.
* SEO report.
* Page speed report.
* Generate multisize favicon.ico from multiple png files.
* Offline HTML validation.

##Usage

```javascript
var mylly = require('mylly');

// Create a mylly instance with path to configuration file.
var prod = mylly('./mylly.prod.js');

// Optionally create another drudge instance with other configuration.
var dev = mylly('./mylly.dev.js');

// Note that you also pass in a configuration object directly.
var dev2 = mylly(Object.assign(require('./mylly.prod.js'), {
  buildPath: './devbuild',
  dist: './devdist',
  collectAssets: null,
  minifyJs: null,
  minifyHtml: null,
  cleanCss: null,
  minifyCss: null,
  sitemap: null,
  browserconfig: null,
  generateImages: null,
  optimizeimages: null,
  browsersync: {
    server: {
      baseDir: './devdist'
    },
    reloadOnRestart: true,
    injectChanges: false
  }
}));

// Clones the default source directory and configuration file to your project
// root.
prod.init();

// Build the dist directory.
prod.build();

// Start up a local development server.
prod.server();

// You can have multiple instances running simultaneously as long as you
// configure browsersync to use different ports.
dev.server();
```

##Configuration

Coming up...

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
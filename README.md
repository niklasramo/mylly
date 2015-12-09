# factotum

Factotum is an opinionated static site generator for Node.js. This project started out as a gulp boilerplate, but has evolved into a node module. The aim here is to build a module that cn automate everything that can be automated (related to building static web sites) purely with Node. Please note that this module is actively developed and not ready for production yet.

##Features

* [Nunjucks](https://mozilla.github.io/nunjucks/) templates with markdown parsing support.
* Validates HTML files according to W3C standards.
* Lints and compiles [Sass](http://sass-lang.com/) stylesheets.
* Removes unused CSS styles.
* Concatenates, minifies and lints JavaScript files.
* Generates fav/touch icons.
* Optimizes images.
* Generates browserconfig.xml.
* Generates sitemap.xml.
* Revisions files.
* BrowserSync development server.

##Install

Coming up...

##Usage

```javascript
var factotum = require('factotum');

// Create a factotum instance with path to configuration file.
// Alternatively you can provide the conffiguration object
// directly here.
var prod = factotum('./drudge.prod.js');

// Optionally create another drudge instance with other configuration.
var dev = factotum('./drudge.dev.js');

// Clones the default source directory and drudge
// configuration file to your project root.
prod.init();

// Build the dist directory.
prod.build();

// Start up a local development server.
prod.server();
```

##Configuration

Coming up...

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
# drudge

A simple (and opinionated) static site generator for Node.js.

**Features**

* Compiles [Nunjucks](https://mozilla.github.io/nunjucks/) templates to static minified HTML files. Data can be passed to Swig templates easily via JSON files.
* Complies [Sass](http://sass-lang.com/) stylesheets to static CSS files.
* Concatenates and minifies JavaScript files.
* Checks JavaScript files for syntax errors with [Esprima](http://esprima.org/).
* Creates resized images from provided source files.
* Optimizes image files (png/jpg/gif/svg) with.
* Enforces your code style conventions with [jscs](http://jscs.info/).
* Revisions files (that you choose) automatically (cache busting).
* Integrates with BrowserSync.

**Coming up...**

* Development and production mode.
  * Development mode does not minify scripts and html.
* Smart revisioning: revision only files which have changed.
* Sass linting.
* JavaScript linting.
* HTML5 validation.
* Automatic markdown parsing.

**Install**

`npm install drudge --save-dev`

**Usage**

```javascript
var drudge = require('drudge');

// Create initial build folder and drudge.json configuration file
drudge.init();

// Build the contents of build folder into dist folder
drudge.build();

// Start up a local development server
drudge.server();
```

**drudge.json**

Drudge allows you to configure a lot of things via the `drudge.json` file. When you call `drudge.init()` the default config file is imported to your project's root. You can modify the file as you wish for your project. Below is the default configuration.

```javascript
```

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
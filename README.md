# mylly

Mylly (finnish for *mill*) is an opinionated static site generator using specific set of Node modules to automate tedious and repetitive tasks.

##Install

`npm install mylly --save-dev`

##Features

* Compile [Nunjucks](https://mozilla.github.io/nunjucks/) templates.
* Compile markdown.
* Validate HTML files according to W3C standards.
* Lint and compile [Sass](http://sass-lang.com/) stylesheets.
* Remove unused CSS styles.
* Concatenate, minify and lint JavaScript files.
* Resize and optimize images.
* Generates sitemap.xml.
* Revision files.
* Launch BrowserSync server.
* Generate build report.

##Usage

Mylly assumes that the source folder is located in a folder named "src" in the root of your project. When `.build()` method is called on Mylly instance a distribution folder named "dist" is automatically created to the root of you project. The distribution folder contains the compiled files which are ready to be exported to the root of your website.

```javascript
// Create a mylly instance.
var mylly = require('mylly')();
// Build the dist directory.
mylly.build();
// Start up a local development server.
mylly.server();
```

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
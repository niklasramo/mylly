# drudge

A simple (and opinionated) static site generator for Node.js.

* Complies your Sass stylesheets to CSS.
* Validates, concatenates and minifies JavaScript files.
* Compile Swig templates into static HTML. You can easily provide data for each Swig template using JSON files.
* Creates resized and optimized png/jpg files from provided source files.

**Install**

`npm install drudge --save-dev`

**Usage**

```javascript
var drudge = require('drudge');

// Create initial build folder and default drudge.json configuration file
drudge.init();

// Build the contents of build folder into dist folder
drudge.build();

// Start up a local development server
drudge.server();
```

**drudge.json**

Drudge allows you to configure a lot of things via the `drudge.json` file. When you call `drudge.init()` the default config file is imported to your project's root. You can modify the file as you wish for your project. Below is the default configuration.

```javascript
{
  "build": "./build",
  "dist": "./dist",
  "ignore": [
    "/static/images/templates",
    "/static/scripts/**/*",
    "/static/styles/**/*",
    "/**/*.ctx.json",
    "/**/[_]*.html",
    "/.jscsrc"
  ],
  "sass_root": "",
  "resize_images": [
    {
      "source": "/static/images/templates/icon.png",
      "sizes": [[192, 192], [180, 180], [152, 152], [144, 144], [120, 120], [114, 114], [76, 76], [72, 72], [57, 57]],
      "target": "/static/images/icon-{{ width }}x{{ height }}.png"
    },
    {
      "source": "/static/images/templates/tile.png",
      "sizes": [[310, 310], [150, 150], [70, 70]],
      "target": "/static/images/tile-{{ width }}x{{ height }}.png"
    },
    {
      "source": "/static/images/templates/tile-wide.png",
      "sizes": [[310, 150]],
      "target": "/static/images/tile-{{ width }}x{{ height }}.png"
    }
  ],
  "jscs": {
    "source": "/static/scripts/*.js",
    "configPath": "./build/.jscsrc"
  },
  "serverPort": 4000,
  "config": {
    "site_url": "",
    "site_name": "My website",
    "site_description": "My website description",
    "site_version": "0.0.1",
    "site_author": "",
    "google_analytics_ua": "",
    "tile_color": "#ffffff",
    "static_path": "/static",
    "styles_path": "/static/styles",
    "scripts_path": "/static/scripts",
    "images_path": "/static/images"
  }
}
```

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
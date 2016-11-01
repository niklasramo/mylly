# Mylly

Mylly is a highly uncustomizable and opinionated Gulp boilerplate that serves as a decent static site generator.

## Features

* None of that Babel shit here, go fork yourself a GWST if you're into that shit.
* A powerful template system powered by [Nunjucks](https://mozilla.github.io/nunjucks/).
* Compile, minify and lint [Sass](http://sass-lang.com/) stylesheets.
* Minify and lint JavaScript files.
* Bundle JavaScript and CSS files.
* Optimize images.
* Generate sitemap.xml.
* Simple file reference revisioning system. Bust that cache!
* Built-in HTTP server with live reloading and cross-device synchronization capabilities (powered by BrowserSync).
* And the list goes on...

## Quick start

1. Download the project.
2. If you haven't already, install **gulp-cli** globally: `npm install -g gulp-cli`.
2. Do your magic in the ***src*** folder, it's the folder that's going to be compiled.
3. Run `npm install` in the project root.
4. Run `gulp mylly:build` in the project root.
5. Your site is now built into the ***dist*** folder, check below for other commands.

## Commands

### `gulp mylly:build`
* Build ***src*** into ***dist***.
* `--dev`: development build (no HTML/JS/CSS minifications, no JS/CSS bundling).

### `gulp mylly:watch`
* Build ***src*** into ***dist*** automatically whenever something changes in ***src***.
* `--dev`: development build (no HTML/JS/CSS minifications, no JS/CSS bundling).

### `gulp mylly:serve`
* Start brower-sync server and build ***src*** into ***dist*** automatically whenever something changes in ***src***.
* `--dev`: development build (no HTML/JS/CSS minifications, no JS/CSS bundling).
* `--livereload`: reload the page automatically at the end of the build.

### `gulp mylly:audit`
* Scan all html files in ***dist*** with a11y (https://www.npmjs.com/package/a11y).

### `gulp mylly:size`
* Log the size of files in ***dist***, per file type and total.

### `gulp mylly:psi`
* Run performance tests for your deployed site with [PageSpeed Insights](https://github.com/addyosmani/psi). The website's url is checked from package.json (`pkg.mylly.url`).
* `--page=path/to/page`: Define a specific page's path (relative to the website root) to test for.
* `--all`: Overrides the `--page` argument and fetches PSI data for all pages.
* `--mobile`: Use mobile strategy, by default desktop strategy is used.

## Configuration

All Mylly's configuration is handled within *package.json* within the `"mylly"` property. Here's the default configuration:

```javascript
"mylly": {
  "url": "https://github.com/niklasramo/mylly",
  "src": "./src",
  "dist": "./dist",
  "eslintConfig": "./src/.eslintrc.json",
  "sasslintConfig": "./src/sass-lint.yml",
  "sitemap": true
}
```

## License

Copyright &copy; 2016 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
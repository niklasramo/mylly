# gulp-drudge

A simple (and opinionated) static site generator powered by Gulp. By default uses Swig for templates and Sass for styles.

**Commands:**

* `gulp`
  * Parses 'build' folder and builds a static site into a folder named 'dist' which, after the build, contains static html/css/js files ready to be deployed as is.
* `gulp server`
  * Starts a live server which runs in port 4000 serving the contents of 'dist' folder. Each time you touch the 'build' folder the build process is ran and the server is restarted.

## License

Copyright &copy; 2015 Niklas Rämö. Licensed under **[the MIT license](LICENSE.md)**.
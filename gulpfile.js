var gulp = require('gulp');

// Import mylly tasks.
require('./mylly.js').forEach(function (task) {
  gulp.task(task.name, task.fn);
});
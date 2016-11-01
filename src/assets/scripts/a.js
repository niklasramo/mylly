(function () {

  console.log('a.js loaded!');

  window.onload = function () {
    console.log('load1');
  };

  window.onload = function () {
    console.log('load2');
  };

})();

Palikka
.define(['jQuery'], function (req, defer, id) {

  return window[id];

})
.define('docReady', ['jQuery'], function (req, defer) {

  req('jQuery')(defer());

})
.define('winReady', function (req, defer) {

  window.addEventListener('load', defer(), false);

});
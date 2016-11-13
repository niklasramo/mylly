module.exports = {
  path: {
    scripts: '/assets/scripts',
    styles: '/assets/styles',
    images: '/assets/images'
  },
  site: {
    url: require('./package.json').mylly.url,
    name: 'My website',
    lang: 'en',
    charset: 'utf-8',
    ua: '' // UA-XXXXXX-XX
  },
  page: {}
};
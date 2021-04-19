if (process.env.NODE_ENV === "development") {
  const { proxyAdapter } = require('meteor/zodern:melte-compiler/hmr-runtime.js');

  module.exports = proxyAdapter;
}

if (process.env.NODE_ENV === "development") {
  const proxyAdapter = require('svelte-hmr/runtime/proxy-adapter-dom.js');

  module.exports = proxyAdapter;
}

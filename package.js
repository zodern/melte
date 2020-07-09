Package.describe({
  name: 'zodern:svelte',
  version: '4.0.0-beta.0',
  summary: 'Svelte compiler',
  git: 'https://github.com/meteor-svelte/meteor-svelte.git',
  documentation: 'README.md'
});

const hmrVersion = '0.8.0'

Package.registerBuildPlugin({
  name: 'svelte-compiler',
  use: [
    'babel-compiler@7.3.4',
    'caching-compiler@1.2.1',
    'ecmascript@0.12.7'
  ],
  sources: [
    'SvelteCompiler.js',
    'plugin.js'
  ],
  npmDependencies: {
    '@babel/runtime': '7.4.3',
    'find-up': '3.0.0',
    htmlparser2: '3.10.1',
    'postcss': '7.0.17',
    'source-map': '0.5.6',
    'svelte-hmr': hmrVersion
  }
});

Npm.depends({
  'svelte-hmr': hmrVersion
})

Package.onUse(function (api) {
  api.versionsFrom('1.8');
  api.use('isobuild:compiler-plugin@1.0.0');

  api.use('modules');
  api.addFiles('hmr-runtime.js', 'client');
  api.addFiles('proxy-adapter.js', 'client');


  // Dependencies for compiled Svelte components (taken from `ecmascript`).
  api.imply([
    'modules',
    'ecmascript-runtime',
    'babel-runtime',
    'promise'
  ]);
});

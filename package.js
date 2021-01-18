Package.describe({
  name: 'zodern:melte',
  version: '1.1.2',
  summary: 'Svelte compiler with tracker integration and HMR',
  git: 'https://github.com/zodern/melte.git',
  documentation: 'README.md'
});

const hmrVersion = '0.12.3'

Package.registerBuildPlugin({
  name: 'melte-compiler',
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
    'recast': '0.19.0',
    'periscopic': '2.0.2',
    'svelte-hmr': hmrVersion,
    'acorn': '7.4.0'
  }
});

Npm.depends({
  'svelte-hmr': hmrVersion
});

Package.onUse(function (api) {
  api.versionsFrom('1.8.1');
  api.use('isobuild:compiler-plugin@1.0.0');
  api.use('modules', 'client');
  api.use('tracker', 'client');

  api.addFiles('tracker.js', 'client');

  // Dependencies for compiled Svelte components (taken from `ecmascript`).
  api.imply([
    'ecmascript-runtime',
    'babel-runtime',
    'promise'
  ]);
});

Package.describe({
  name: 'zodern:melte',
  version: '1.7.2',
  summary: 'Svelte compiler with tracker integration, HMR and Typescript support',
  git: 'https://github.com/zodern/melte.git',
  documentation: 'README.md'
});

Package.registerBuildPlugin({
  name: 'melte-compiler',
  use: [
    'ecmascript@0.12.7',
    'zodern:melte-compiler@1.4.1'
  ],
  sources: [
    'plugin.js'
  ],
  npmDependencies: {
    '@babel/runtime': '7.4.3',
  }
});

Package.onUse(function (api) {
  api.versionsFrom('1.8.1');
  api.use('isobuild:compiler-plugin@1.0.0');
  api.use('ecmascript@0.12.7', 'client');
  api.use('tracker', 'client');
  api.use('zodern:melte-compiler', 'client');

  api.addFiles('tracker.js', 'client');

  // Dependencies for compiled Svelte components (taken from `ecmascript`).
  api.imply([
    'ecmascript-runtime',
    'babel-runtime',
    'promise@0.11.2||1.0.0-beta.300-6'
  ]);
});

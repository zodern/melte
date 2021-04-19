import MelteCompiler from 'meteor/zodern:melte-compiler/MelteCompiler.js';
import options from 'meteor/zodern:melte-compiler/options.js';

Plugin.registerCompiler({
  extensions: (options && options.extensions) || ['svelte']
}, () => new MelteCompiler(options));

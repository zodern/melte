const { makeApplyHmr } = require('svelte-hmr/runtime');

module.exports.applyHmr = makeApplyHmr(args => {
  // Mark this file as reloadable
  args.m.hot.accept();

  return Object.assign({}, args, {
    hot: {
      ...args.m.hot,
      accept(cb) {
        // svelte-hmr expects accept to work as nollup or vite
        // applying changes is done synchronously, so we wait until after it is done
        setTimeout(() => cb(), 10);
      }
    }
  })
});

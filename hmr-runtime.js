const { makeApplyHmr } = require('svelte-hmr/runtime');

module.exports.applyHmr = makeApplyHmr(args => {
  // Mark this file as reloadable
  args.m.hot.accept();

  let acceptCallback = null;
  if (args.m.hot.data?.acceptCallback) {
    // svelte-hmr expects accept to work as with nollup or vite
    // applying changes is done synchronously, so we wait until after it is done
    setTimeout(() => args.m.hot.data.acceptCallback(), 10);
  }

  args.m.hot.dispose((data) => {
    if (acceptCallback) {
      data.acceptCallback = acceptCallback;
    }
  });

  return Object.assign({}, args, {
    hot: {
      ...args.m.hot,
      accept(cb) {
        acceptCallback = cb;
      }
    },
    reload() {
      if (Package && Package.reload) {
        Package.reload._reload({ immediateMigration: true });
      } else {
        window.location.reload();
      }
    }
  });
});

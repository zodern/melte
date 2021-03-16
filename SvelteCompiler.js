import htmlparser from 'htmlparser2';
import postcss from 'postcss';
import sourcemap from 'source-map';
import { parse, print, types } from 'recast';
import acorn from 'recast/parsers/acorn';
import typescript from 'recast/parsers/typescript';
import { analyze, extract_names } from 'periscopic';

import { processCode } from './scss-processor';

function createRecastParser (isTS = false) {
  const parser = isTS ? typescript : acorn;

  return {
    parse (_, options) {
      options.ecmaVersion = 2020;

      return parser.parse.apply(acorn, arguments);
    }
  };
}

const b = types.builders;

const TRACKER_WRAPPER_PREFIX = '_m_tracker';
const TRACKER_WRAPPER_CREATOR = '_m_createReactiveWrapper';
const SCSS_STYLE_REGEX = /<style[^>]+lang=['"]scss['"]/;

const { createMakeHot } = require('svelte-hmr');

// PREPROCESS_VERSION can be used in development
// to invalidate caches
// In a published package, the cache is reset
// whenever the app updates to a new version.
const PREPROCESS_VERSION = 8;

const PACKAGE_NAME = 'zodern:melte';

SvelteCompiler = class SvelteCompiler extends CachingCompiler {
  constructor(options = {}) {
    super({
      compilerName: 'svelte',
      defaultCacheSize: 1024 * 1024 * 10
    });

    this.options = options;
    this.babelCompiler = new BabelCompiler;

    // Don't attempt to require `svelte/compiler` during `meteor publish`.
    if (!options.isPublishing) {
      try {
        this.svelte = require('svelte/compiler');
      } catch (error) {
        throw new Error(
          'Cannot find the `svelte` package in your application. ' +
          'Please install it with `meteor npm install `svelte`.'
        );
      }

      try {
        this.ts = require('svelte-preprocess/dist/transformers/typescript');
      } catch (error) {
        throw new Error(
          'Cannot find the `svelte-preprocess` package in your application. ' +
          'Please install it with `meteor npm install `svelte-preprocess`.'
        );
      }

      this.makeHot = createMakeHot({
        meta: 'module',
        walk: this.svelte.walk,
        absoluteImports: false,
        hotApi: `meteor/${PACKAGE_NAME}/hmr-runtime.js`,
        preserveLocalState: false,
        adapter: `meteor/${PACKAGE_NAME}/proxy-adapter.js`,
      });
    }

    if (options.postcss) {
      this.postcss = postcss(options.postcss.map(plugin => {
        if (typeof plugin == 'string') {
          return require(plugin)();
        } else {
          const [packageName, options] = plugin;
          return require(packageName)(options);
        }
      }));
    }
  }

  hmrAvailable (file) {
    return typeof file.hmrAvailable === 'function' && file.hmrAvailable();
  }

  getCacheKey (file) {
    if (SCSS_STYLE_REGEX.test(file.getContentsAsString())) {
      // We intentionally omit caching now for components with SCSS styles,
      // otherwise it will demand a really complicated way of tracking
      // imported files as dependencies.
      return Date.now() + Math.random();
    }

    return [
      this.options,
      file.getPathInPackage(),
      file.getSourceHash(),
      file.getArch(),
      file.getPackageName(),
      this.hmrAvailable(file),
      {
        svelteVersion: this.svelte.VERSION,
        preprocessVersion: PREPROCESS_VERSION
      },
    ];
  }

  setDiskCacheDirectory (cacheDirectory) {
    this._diskCache = cacheDirectory;
  }

  _setBabelCacheDirectory (suffix) {
    // Babel doesn't use the svelte or preprocessor versions in its cache keys
    // so we instead use the versions in the cache path
    const babelSuffix = `-babel-${(this.svelte || {}).VERSION}-${PREPROCESS_VERSION}-${suffix || ''}`;
    this.babelCompiler.setDiskCacheDirectory(this._diskCache + babelSuffix);
  }

  // The compile result returned from `compileOneFile` can be an array or an
  // object. If the processed HTML file is not a Svelte component, the result is
  // an array of HTML sections (head and/or body). Otherwise, it's an object
  // with JavaScript from a compiled Svelte component.
  compileResultSize (result) {
    let size = 0;

    if (Array.isArray(result)) {
      result.forEach(section => size += section.data.length);
    } else {
      size = result.data.length + result.sourceMap.toString().length;
    }

    return size;
  }

  getHtmlSections (file) {
    const path = file.getPathInPackage();
    const extension = path.substring(path.lastIndexOf('.') + 1);

    if (extension !== 'html') {
      return;
    }

    const code = file.getContentsAsString();
    const sections = [];
    let isSvelteComponent = true;

    htmlparser.parseDOM(code).forEach(el => {
      if (el.name === 'head' || el.name === 'body') {
        isSvelteComponent = false;

        sections.push({
          section: el.name,
          data: htmlparser.DomUtils.getInnerHTML(el).trim()
        });
      }
    });

    if (!isSvelteComponent) {
      return sections;
    }
  }

  compileOneFileLater (file, getResult) {
    // Search for top-level head and body tags. If at least one of these tags
    // exists, the file is not processed with the Svelte compiler. Instead, the
    // inner HTML of the tags is added to the respective section in the HTML
    // output generated by Meteor.
    const sections = this.getHtmlSections(file);

    if (sections) {
      sections.forEach(section => file.addHtml(section));
    } else {
      file.addJavaScript({
        path: file.getPathInPackage()
      }, async () => {
        return await getResult();
      });
    }
  }

  async compileOneFile (file) {
    // Search for head and body tags if lazy compilation isn't supported.
    // Otherwise, the file has already been parsed in `compileOneFileLater`.
    if (!file.supportsLazyCompilation) {
      const sections = this.getHtmlSections(file);

      if (sections) {
        return sections;
      }
    }

    let code = file.getContentsAsString();
    let map;
    const basename = file.getBasename();
    const path = file.getPathInPackage();
    const arch = file.getArch();

    const svelteOptions = {
      dev: process.env.NODE_ENV !== 'production',
      filename: path,
      name: basename
        .slice(0, basename.indexOf('.')) // Remove extension
        .replace(/[^a-z0-9_$]/ig, '_') // Ensure valid identifier
    };

    // If the component was imported by server code, compile it for SSR.
    if (arch.startsWith('os.')) {
      svelteOptions.generate = 'ssr';
    } else {
      const { hydratable, css } = this.options;

      if (hydratable === true) {
        svelteOptions.hydratable = true;
      }

      if (css === false) {
        svelteOptions.css = false;
      }
    }

    let error;
    try {
      ({ code, map } = (await this.svelte.preprocess(code, {
        script ({ content, attributes }) {
          // Reactive statements are not supported in the module script
          if (attributes.context === 'module') {
            return;
          }
          let ast;

          try {
            ast = parse(content, { parser: createRecastParser(attributes.lang === 'ts') });
          } catch (e) {
            error = e;
            console.lof(e.stack)
            return content;
          }

          let modified = false;
          let uniqueIdCount = 0;
          let injectedReactiveVars = [];

          let { globals } = analyze(ast.program.body);

          // Only look for top-level labels
          for (let i = 0; i < ast.program.body.length; i++) {
            let node = ast.program.body[i];

            if (node.type === 'LabeledStatement' && node.label.name === '$m') {
              modified = true;

              // Check if we should add a variable declaration
              // Svelte adds missing declarations for variables assigned to
              // in reactive assignment expressions, but due to how we wrap the
              // reactive statement it is no longer detectable by Svelte
              if (node.body.type === 'ExpressionStatement') {
                let expression = node.body.expression;
                if (
                  expression.type === 'AssignmentExpression' &&
                  expression.left.type !== 'MemberExpression'
                ) {
                  extract_names(expression.left).forEach(name => {
                    // Svelte's implementation does not inject declarations for variables
                    // declared in the module scope. Variables in the module scope are never
                    // reactive, but assigning to them in a reactive statement doesn't error.
                    // Here we are not checking for that, which could cause runtime errors
                    if (name[0] !== '$' && globals.has(name)) {
                      injectedReactiveVars.push(name);
                    }
                  });
                }
              }

              ast.program.body[i] = b.labeledStatement(
                b.identifier('$'),
                b.expressionStatement(
                  b.callExpression(
                    b.identifier(`${TRACKER_WRAPPER_PREFIX}${uniqueIdCount++}`),
                    [
                      b.arrowFunctionExpression(
                        [],
                        b.blockStatement([
                          node.body
                        ])
                      )
                    ]
                  )
                )
              );
            }
          }

          if (modified) {
            for (let i = 0; i < injectedReactiveVars.length; i++) {
              ast.program.body.unshift(
                b.variableDeclaration('let', [
                  b.variableDeclarator(
                    b.identifier(injectedReactiveVars[i])
                  )
                ])
              );
            }

            for (let i = 0; i < uniqueIdCount; i++) {
              ast.program.body.unshift(
                b.variableDeclaration('const', [
                  b.variableDeclarator(
                    b.identifier(`${TRACKER_WRAPPER_PREFIX}${i}`),
                    b.callExpression(b.identifier(TRACKER_WRAPPER_CREATOR), [])
                  )
                ]));
            }

            ast.program.body.unshift(
              b.importDeclaration(
                [
                  b.importSpecifier(
                    b.identifier('createReactiveWrapper'),
                    b.identifier(TRACKER_WRAPPER_CREATOR)
                  )
                ],
                b.literal(`meteor/${PACKAGE_NAME}/tracker`)
              ));
          }

          const processedCode = modified ? print(ast).code : content;

          return attributes.lang === 'ts'
            ? ts({ content: processedCode, filename: path })
            : { code: processedCode };
        },
        style: async ({ content, attributes }) => {
          if (this.postcss) {
            if (attributes.lang == 'postcss') {
              return {
                code: await this.postcss.process(content, { from: undefined })
              };
            }
          }

          if (attributes.lang === 'scss') {
            const shallEmit = 'global' in attributes;
            const result = await processCode(file, path, { content, attributes });

            result?.dependencies?.forEach((dependencyPath) => {
              file.readAndWatchFile(dependencyPath);
            });

            if (!shallEmit) {
              return result;
            }

            file.addStylesheet({
              path: file.getBasename() + '.scss',
              data: result.code,
              sourceMap: result.map,
              lazy: false,
            });

            return { code: '/** extracted into global style */' };
          }
        }
      })));
    } catch (e) {
      file.error(e);
      return;
    }

    if (error) {
      file.error(error);
      return;
    }

    let compiledResult;
    try {
      compiledResult = this.svelte.compile(code, svelteOptions);

      if (map) {
        compiledResult.js.map = this.combineSourceMaps(map, compiledResult.js.map);
      }

    } catch (e) {
      file.error(e);
      return;
    }

    if (this.hmrAvailable(file)) {
      compiledResult.js.code = this.makeHot(
        path,
        compiledResult.js.code,
        {},
        compiledResult,
        code,
        svelteOptions
      );

      // makeHot is hard coded to use `import.meta` in some places
      // even when using the `meta` option.
      compiledResult.js.code = compiledResult.js.code.replace(
        'import.meta && import.meta.hot',
        'module && module.hot'
      );
    }

    try {
      return this.transpileWithBabel(
        compiledResult.js,
        path,
        file
      );
    } catch (e) {
      // Throw unknown errors.
      if (!e.start) {
        throw e;
      }

      let message;

      if (e.frame) {
        // Prepend a vertical bar to each line to prevent Meteor from trimming
        // whitespace and moving the code frame indicator to the wrong position.
        const frame = e.frame.split('\n').map(line => {
          return `| ${line}`;
        }).join('\n');

        message = `${e.message}\n\n${frame}`;
      } else {
        message = e.message;
      }

      file.error({
        message,
        line: e.start.line,
        column: e.start.column
      });
    }
  }

  addCompileResult (file, result) {
    if (Array.isArray(result)) {
      result.forEach(section => file.addHtml(section));
    } else {
      file.addJavaScript(result);
    }
  }

  transpileWithBabel (source, path, file) {
    // We need a different folder when HMR is enabled
    // to prevent babel from using those cache entries
    // in production builds
    this._setBabelCacheDirectory(this.hmrAvailable(file) ? '-hmr' : '');

    const {
      data,
      sourceMap
    } = this.babelCompiler.processOneFileForTarget(file, source.code);

    return {
      sourcePath: path,
      path,
      data,
      sourceMap: this.combineSourceMaps(sourceMap, source.map)
    };
  }

  // Generates a new source map that maps a file transpiled by Babel back to the
  // original HTML via a source map generated by the Svelte compiler.
  combineSourceMaps (targetMap, originalMap) {
    const result = new sourcemap.SourceMapGenerator;

    const targetConsumer = new sourcemap.SourceMapConsumer(targetMap);
    const originalConsumer = new sourcemap.SourceMapConsumer(originalMap);

    targetConsumer.eachMapping(mapping => {
      // Ignore mappings that don't have a source.
      if (!mapping.source) {
        return;
      }

      const position = originalConsumer.originalPositionFor({
        line: mapping.originalLine,
        column: mapping.originalColumn
      });

      // Ignore mappings that don't map to the original HTML.
      if (!position.source) {
        return;
      }

      result.addMapping({
        source: position.source,
        original: {
          line: position.line,
          column: position.column
        },
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      });
    });

    if (originalMap.sourcesContent && originalMap.sourcesContent.length) {
      // Copy source content from the source map generated by the Svelte compiler.
      // We can just take the first entry because only one file is involved in the
      // Svelte compilation and Babel transpilation.
      result.setSourceContent(originalMap.sources[0], originalMap.sourcesContent[0]);
    }

    return result.toJSON();
  }
};

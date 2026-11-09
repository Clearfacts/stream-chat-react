// @flow
import babel from '@rollup/plugin-babel';
import external from 'rollup-plugin-peer-deps-external';
import commonjs from '@rollup/plugin-commonjs';
import sass from 'sass';
import json from '@rollup/plugin-json';
import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import replace from '@rollup/plugin-replace';

import { createRequire } from 'module';
import process from 'process';

const pkg = createRequire(import.meta.url)('./package.json');
process.env.NODE_ENV = 'production';

// The (s)css imports in src/index.js mirror src/styles/index.scss. Compile that file once, so the
// CSS keeps the declared order (bundling the imports one by one reorders them).
const stylesheet = () => ({
  name: 'stylesheet',
  resolveId: (id, importer) => (/\.s?css$/.test(id) && importer ? `\0style:${id}` : null),
  load: (id) => (id.startsWith('\0style:') ? '' : null),
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: pkg.style.replace(/^dist\//, ''),
      source: sass.renderSync({ file: 'src/styles/index.scss', includePaths: ['node_modules'] }).css.toString(),
    });
  },
});

const baseConfig = {
  input: 'src/index.js',
  cache: false,
  watch: {
    chokidar: false,
  },
};

const normalBundle = {
  ...baseConfig,
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
  ],
  external: [
    'anchorme',
    'moment',
    'stream-chat-client',
    'react-images',
    'lodash/debounce',
    'lodash/throttle',
    'lodash/truncate',
    'lodash/uniq',
    'lodash.uniqby',
    'emoji-mart',
    'emoji-mart/data/all.json',
    'emoji-regex',
    'seamless-immutable',
    'isomorphic-ws',
    'visibilityjs',
    'custom-event',
    'textarea-caret',
    '@braintree/sanitize-url',
    '@webscopeio/react-textarea-autocomplete',
    'react-dropzone',
    'react-markdown',
    'deep-equal',
    'shallow-diff',
    'immutable',
    'url-parse',
    'stream-chat',
    'pretty-bytes',
    'stream-analytics',
    'react-textarea-autosize',
    'prop-types',
    'react-player',
    'react-file-utils',
    'uuid/v4',
    '@fortawesome/react-fontawesome',
    '@fortawesome/free-regular-svg-icons',
    '@babel/runtime/regenerator',
    '@babel/runtime/helpers/asyncToGenerator',
    '@babel/runtime/helpers/objectWithoutProperties',
    '@babel/runtime/helpers/toConsumableArray',
    '@babel/runtime/helpers/objectSpread',
    '@babel/runtime/helpers/extends',
    '@babel/runtime/helpers/defineProperty',
    '@babel/runtime/helpers/assertThisInitialized',
    '@babel/runtime/helpers/inherits',
    '@babel/runtime/helpers/getPrototypeOf',
    '@babel/runtime/helpers/possibleConstructorReturn',
    '@babel/runtime/helpers/createClass',
    '@babel/runtime/helpers/classCallCheck',
    '@babel/runtime/helpers/slicedToArray',
    '@babel/runtime/helpers/typeof',
    'react-intl',
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    external(),
    commonjs({ include: /node_modules/, transformMixedEsModules: true }),
    json(),
    babel({
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
    }),
    stylesheet(),
    copy({
      targets: [
        { src: 'src/assets/*', dest: 'dist/assets' },
        { src: 'src/translations/*', dest: 'dist/translations' },
      ],
      verbose: true,
    }),
    url(),
  ],
};

const fullBrowserBundle = {
  ...baseConfig,
  output: [
    {
      file: pkg.jsdelivr,
      format: 'iife',
      sourcemap: true,
      name: 'window', // write all exported values to window
      extend: true, // extend window, not overwrite it
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    external(),
    {
      name: 'ignore-css-and-scss',
      resolveId: (importee) => (importee.match(/.s?css$/) ? importee : null),
      load: (id) => (id.match(/.s?css$/) ? '' : null),
    },
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs({ include: /node_modules/, transformMixedEsModules: true }),
    nodePolyfills(),
    json(),
    babel({
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
    }),
    url(),
  ],
};

export default () =>
  process.env.ROLLUP_WATCH ? [normalBundle] : [normalBundle, fullBrowserBundle];

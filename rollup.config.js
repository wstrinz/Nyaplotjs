import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';

export default {
  entry: 'es6/main.js',
  dest: 'dist/nyaplot.iife.js',
  sourceMap: true,
  moduleName: 'Nyaplot',
  format: 'iife',
  globals: {
    export: "Export"
  },
  plugins: [ babel() ]
};

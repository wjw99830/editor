import resolve from 'rollup-plugin-node-resolve';
import cjs from 'rollup-plugin-commonjs';
import ts2 from 'rollup-plugin-typescript2';
import pkg from './package.json';

export default {
  input: pkg.main,
  plugins: [
    resolve(),
    cjs(),
    ts2(),
  ],
  output: [{
    file: pkg.module,
    format: 'es',
  }, {
    file: pkg.umd,
    format: 'umd',
    name: 'Editor',
  }],
};

import ts2 from 'rollup-plugin-typescript2';
import pkg from './package.json';

export default {
  input: pkg.main,
  plugins: [
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

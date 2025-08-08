import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import del from 'rollup-plugin-delete';

export default {
  input: 'src/cli.js',
  output: {
    file: 'dist/cli.cjs',
    format: 'cjs',
    banner: '#!/usr/bin/env node',
    sourcemap: false,
    inlineDynamicImports: true,
  },
  plugins: [
    del({ targets: 'dist/*' }),
    resolve({ preferBuiltins: true }),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      exclude: 'node_modules/**',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: 'node >= 12',
            useBuiltIns: 'usage',
            corejs: 3,
          },
        ],
      ],
      plugins: ['@babel/plugin-transform-runtime'],
    }),
    // terser(),
  ],
  external: ['node-ssh', 'archiver', 'commander', 'inquirer', 'dotenv'],
};

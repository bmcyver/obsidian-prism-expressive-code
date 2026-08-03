import path from 'node:path';
import { builtinModules } from 'node:module';
import { defineConfig, type UserConfig } from 'vite';

const entryFile = 'src/main.ts';

export default defineConfig(({ mode }) => {
  const prod = mode === 'production';
  const outDir = 'dist/';

  return {
    resolve: {
      alias: {
        src: path.resolve(__dirname, './src'),
      },
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, entryFile),
        name: 'main',
        fileName: () => 'main.js',
        formats: ['cjs'],
      },
      minify: prod,
      target: 'esnext',
      sourcemap: prod ? false : 'inline',
      cssCodeSplit: false,
      emptyOutDir: false,
      outDir,
      rolldownOptions: {
        input: {
          main: path.resolve(__dirname, entryFile),
        },
        output: {
          dir: outDir,
          entryFileNames: 'main.js',
          assetFileNames: 'styles.css',
          codeSplitting: false,
        },
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
          ...builtinModules,
        ],
      },
    },
  } as UserConfig;
});

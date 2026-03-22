import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const enableSourceMap = mode !== 'production'

  return {
    plugins: [
      react(),
      electron({
        main: {
          entry: path.resolve(__dirname, 'electron/main.ts'),
          onstart({ startup }) {
            startup()
          },
          vite: {
            build: {
              outDir: 'dist-electron/main',
              sourcemap: enableSourceMap,
              emptyOutDir: true,
              rollupOptions: {
                external: ['electron'],
                output: {
                  format: 'cjs',
                  entryFileNames: 'index.js',
                },
              },
            },
          },
        },
        preload: {
          input: {
            preload: path.resolve(__dirname, 'electron/preload.ts'),
          },
          vite: {
            build: {
              outDir: 'dist-electron/preload',
              sourcemap: enableSourceMap,
              emptyOutDir: true,
              rollupOptions: {
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].js',
                },
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        logOverride: {
          directives: 'silent',
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      sourcemap: enableSourceMap,
    },
  }
})

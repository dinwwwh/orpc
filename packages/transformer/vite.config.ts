import unplugin from '@dinwwwh/unplugin'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        'bracket-notation': 'src/bracket-notation.ts',
        'zod-coerce-parse': 'src/zod-coerce-parse.ts',
      },
      formats: ['es'],
    },
  },
  plugins: [unplugin.vite()],
})
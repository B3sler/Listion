import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: './src',
    environment: 'node',
  },
  // SWC erzeugt die Decorator-Metadaten, die NestJS für Dependency Injection braucht.
  plugins: [swc.vite({ module: { type: 'es6' } })],
})

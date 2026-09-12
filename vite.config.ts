import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    allowedHosts: ['saya', 'zelan', 'synthform'],
    host: true,
    port: 8008
  },
  // The deployed container runs `vite preview`, which checks the Host header.
  // On Demi it is bound to localhost and fronted by Tailscale Serve for the
  // telestrator on the iPad, so the tailnet name has to be allowed here or
  // the page 403s with "Blocked request" (docs/telestrator-v1.5.md, §4A).
  preview: {
    allowedHosts: ['demi', 'demi.tailnet-dffc.ts.net'],
  },
})

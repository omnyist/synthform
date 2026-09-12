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
    // Same-origin WebSocket paths for the HTTPS case. A page served over
    // https cannot open ws:// (mixed content), so on the iPad the overlay
    // socket and OBS's websocket go through the preview server instead:
    //   wss://<origin>/ws/overlay/<slug>/ -> ws://saya:7178/ws/overlay/<slug>/
    //   wss://<origin>/obs                -> ws://127.0.0.1:4455 (OBS on Demi)
    // The OBS browser sources load http://localhost:8008 and keep their
    // direct ws:// paths (see use-server.ts / use-obs-screenshot.ts).
    proxy: {
      '/ws': { target: 'ws://saya:7178', ws: true, changeOrigin: true },
      // OBS runs on the host; in the prod container that is host.docker.internal
      // (docker-compose.prod.yml maps it to the host gateway). OBS_WS_TARGET
      // overrides for a dev server run outside the container.
      '/obs': { target: process.env.OBS_WS_TARGET || 'ws://host.docker.internal:4455', ws: true, rewrite: (path) => path.replace(/^\/obs/, '') },
    },
  },
})

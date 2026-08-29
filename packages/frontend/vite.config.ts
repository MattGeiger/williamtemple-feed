import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, loadEnv } from "vite"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"
 
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  loadEnv(mode, process.cwd(), '')  // Load env file based on mode
  
  return {
    plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // Bind every interface, not just `localhost`. Vite's default resolves to
      // the IPv6 loopback only, so an iOS Simulator — which resolves
      // `localhost` to IPv4 127.0.0.1 — is refused outright, as is any device
      // on the LAN.
      host: true,
      proxy: {
        '/api': {
          // 127.0.0.1, not `localhost`. The same name-resolution trap that made
          // the dev server unreachable from the simulator applies to the proxy
          // target: `localhost` can resolve to ::1 first, so the proxy chases an
          // address the API may not be listening on.
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (error, request, response) => {
              const target = request.url ?? ''
              // index.html links /api/brand/theme.css as a stylesheet, so a
              // backend that is not up yet fails the document's own subresource
              // and prints a stack trace that reads like an application fault.
              // It is neither: with no runtime brand the compiled default in
              // index.css is already the correct appearance. Answer with an
              // empty sheet and say plainly what is actually wrong.
              if (target.startsWith('/api/brand/theme.css')) {
                const res = response as import('node:http').ServerResponse
                if (!res.headersSent) {
                  res.writeHead(200, { 'Content-Type': 'text/css' })
                  res.end('/* backend unreachable — using the compiled default appearance */\n')
                }
                return
              }
              const code = (error as NodeJS.ErrnoException).code
              if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
                console.warn(
                  `[api] ${target} — backend not reachable on 127.0.0.1:3001. ` +
                    'Start it with `npm run dev` in packages/backend.'
                )
                const res = response as import('node:http').ServerResponse
                if (!res.headersSent) {
                  res.writeHead(503, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: { message: 'The FEED API is not running.', code: 'API_UNREACHABLE' } }))
                }
                return
              }
              console.warn(`[api] proxy error on ${target}: ${String(error)}`)
            })
          },
        },
      },
    },
    // Vite options tailored for production mode
    ...(mode === 'production' && {
      build: {
        sourcemap: true
      }
    })
  }
})

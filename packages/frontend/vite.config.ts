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
      proxy: {
        '/api': 'http://localhost:3001',
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

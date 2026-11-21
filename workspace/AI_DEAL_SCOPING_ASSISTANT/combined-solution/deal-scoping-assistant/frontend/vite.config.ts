import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: { port: 5173 },
  build: {
    // Mermaid is loaded on demand and ships large sub-modules (cytoscape, katex) that are
    // never on the first paint; the entry chunk itself stays well under the default limit.
    chunkSizeWarningLimit: 700,
  },
})

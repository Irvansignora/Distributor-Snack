import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import fs from "fs"

// ── Plugin: inject BUILD_TIMESTAMP ke sw.js saat build ───────────────────────
// Setiap `vite build`, placeholder __BUILD_TIMESTAMP__ di sw.js diganti
// dengan Unix timestamp aktual → CACHE_VERSION selalu unik → SW lama mati.
function injectSwTimestamp(): Plugin {
  const timestamp = Date.now().toString();
  return {
    name: 'inject-sw-timestamp',
    // Saat build selesai, patch sw.js di dist/
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, 'utf-8');
        const patched = content.replace(/__BUILD_TIMESTAMP__/g, timestamp);
        fs.writeFileSync(swPath, patched);
        console.log(`[sw] CACHE_VERSION → snackhub-v${timestamp}`);
      }
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), injectSwTimestamp()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Pisah vendor chunks agar cache lebih efisien
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          ui: ['lucide-react', 'sonner', 'date-fns'],
        },
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});

import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Pastikan chunk lama tidak di-cache — hash berubah setiap build
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
    // Hapus console.log di production
    minify: 'esbuild',
    sourcemap: false,
  },
});

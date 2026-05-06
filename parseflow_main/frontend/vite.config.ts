import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: true,
      allowedHosts: [
        "parseflow-app-bqfj.onrender.com",
        "parseflow-frontend.onrender.com",
        "localhost",
        "127.0.0.1",
      ],
      proxy: {
        '/api': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/upload': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/files': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/notifications': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/documents': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/docbot': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://backend:5000',
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    build: {
      outDir: "dist",
    },
  };
});

import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const n8nBaseUrl = env.VITE_N8N_BASE_URL || 'http://localhost:5678';

  const isElectron = process.env.npm_lifecycle_event && process.env.npm_lifecycle_event.includes('desktop');
  const basePath = isElectron ? './' : '/solar/';

  return {
    base: basePath,
    plugins: isElectron ? [
      electron({
        main: {
          entry: 'electron/main.js',
        },
        preload: {
          input: 'electron/preload.js',
        },
      })
    ] : [],
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      port: 3000,
      open: true,
      // Proxy para N8N: evita problemas de CORS en desarrollo
      proxy: {
        '/n8n': {
          target: n8nBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/n8n/, ''),
        },
      },
    },
  };
});

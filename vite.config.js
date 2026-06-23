import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const n8nBaseUrl = env.VITE_N8N_BASE_URL || 'http://localhost:5678';

  return {
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

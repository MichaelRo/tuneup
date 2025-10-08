import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type ServerOptions } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function getHttpsConfig() {
  const certPath = process.env.VITE_DEV_CERT
    ? resolve(__dirname, process.env.VITE_DEV_CERT)
    : resolve(__dirname, 'certs/localhost.pem');

  const keyPath = process.env.VITE_DEV_KEY
    ? resolve(__dirname, process.env.VITE_DEV_KEY)
    : resolve(__dirname, 'certs/localhost-key.pem');

  if (existsSync(certPath) && existsSync(keyPath)) {
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  }

  return undefined;
}

const serverOptions: ServerOptions = {
  https: getHttpsConfig(),
  host: 'localhost',
};

export default defineConfig(({ command }) => ({
  appType: 'spa',
  plugins: [
    visualizer({
      open: false, // Set to true to automatically open the report
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: command === 'build' ? '/tuneup/' : '/',
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  server: { ...serverOptions, port: 5173, open: true },
  preview: { ...serverOptions },
}));

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const certDir = process.env.VITE_DEV_CERT_DIR
  ? resolve(rootDir, process.env.VITE_DEV_CERT_DIR)
  : resolve(rootDir, 'certs');
const certPath = process.env.VITE_DEV_CERT
  ? resolve(rootDir, process.env.VITE_DEV_CERT)
  : resolve(certDir, 'localhost.pem');
const keyPath = process.env.VITE_DEV_KEY
  ? resolve(rootDir, process.env.VITE_DEV_KEY)
  : resolve(certDir, 'localhost-key.pem');

// Support local HTTPS dev/preview with custom or default certs. Override with env vars as needed.
const hasCustomCert = existsSync(certPath) && existsSync(keyPath);
const httpsConfig = hasCustomCert
  ? {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    }
  : false;

export default defineConfig(({ command }) => ({
  appType: 'spa',
  base: command === 'build' ? '/tuneup/' : '/',
  build: {
    target: 'es2020',
  },
  server: {
    https: httpsConfig || undefined,
    host: 'localhost',
    port: 5173,
    open: true,
  },
  preview: {
    https: httpsConfig || undefined,
    port: 4173,
  },
}));

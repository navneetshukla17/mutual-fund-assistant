import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.resolve(__dirname, 'certs/cert.pem');
const keyPath = path.resolve(__dirname, 'certs/key.pem');
const hasHttpsCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: hasHttpsCerts ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    } : false,
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
});

import axios from 'axios';

// Tell TypeScript that `import.meta.env` has our variable
declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL: string;
    readonly VITE_APP_NAME: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Now read it properly:
const rawBackend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const backend = String(rawBackend).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${backend}/api`,
});

export const BACKEND_URL = backend;
export default api;

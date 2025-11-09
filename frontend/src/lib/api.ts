import axios from 'axios';

// Read backend URL from Vite env. Vite only exposes variables prefixed with VITE_.
// Use VITE_BACKEND_URL (e.g. VITE_BACKEND_URL=http://localhost:4000) in `frontend/.env`.
const rawBackend = (import.meta as any).VITE_BACKEND_URL || 'http://localhost:4000';
const backend = String(rawBackend).replace(/\/$/, '');

// baseURL should include the /api prefix
const api = axios.create({
  baseURL: `${backend}/api`,
});

export const BACKEND_URL = backend; // e.g. 'http://localhost:4000'

export default api;
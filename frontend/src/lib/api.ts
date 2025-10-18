import axios from 'axios';

// This baseURL MUST include the '/api' prefix
const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

export default api;
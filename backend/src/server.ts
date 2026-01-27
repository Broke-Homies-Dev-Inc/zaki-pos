import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import apiRoutes from './routes/Index'; // This line should now work

dotenv.config();
console.log(process.env.DATABASE_URL)

const app = express();
const port = process.env.PORT || 4000;


// Middleware
app.use(cors());
app.use(express.json());

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Runtime DB connectivity flag (updated by checkDatabaseConnection)
export let dbConnected = false;

// Check DB connection with a few retries and backoff. Sets `dbConnected`.
async function checkDatabaseConnection(retries = 2, delayMs = 2000): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      dbConnected = true;
      console.log('✅ Database connection successful');
      return true;
    } catch (err: any) {
      dbConnected = false;
      console.error(`⚠️ Database connection attempt ${attempt + 1} failed:`, err && err.message ? err.message : err);
      if (attempt < retries) {
        // wait before retrying
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }
  console.error('❌ All database connection attempts failed');
  return false;
}

// Use the main router for all requests to /api
app.use('/api', apiRoutes);

// Health endpoint to verify server + DB connectivity
app.get('/api/health', (_req, res) => {
  res.json({
    server: 'ok',
    dbConnected,
    databaseUrlConfigured: !!process.env.DATABASE_URL
  });
});

// Start the server after a short DB connectivity check (non-blocking if DB is down)
(async () => {
  // Try to verify DB connection (will set dbConnected)
  await checkDatabaseConnection();

  const server = app.listen(port, () => {
    console.log(`✅ Backend server running at http://localhost:${port}`);
    console.log(`   DB connected: ${dbConnected}`);
  });

  // Setup WebSocket
  import('./websocket').then(({ setupWebSocket, connectToWaiterDev }) => {
    setupWebSocket(server);
    connectToWaiterDev();
  });
})();
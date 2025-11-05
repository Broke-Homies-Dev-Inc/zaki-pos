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

// Use the main router for all requests to /api
app.use('/api', apiRoutes);

// Start the server
app.listen(port, () => {
  console.log(`✅ Backend server running at http://localhost:${port}`);
});
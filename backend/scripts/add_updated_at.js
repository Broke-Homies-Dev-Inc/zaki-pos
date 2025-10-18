require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

const alterStatement = `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();`;

(async () => {
  console.log('🔧 Adding updated_at column to restaurant_tables...\n');
  
  try {
    console.log(`Running: ${alterStatement}`);
    await pool.query(alterStatement);
    console.log('✅ Success - updated_at column added!\n');
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
  }
  
  await pool.end();
})();

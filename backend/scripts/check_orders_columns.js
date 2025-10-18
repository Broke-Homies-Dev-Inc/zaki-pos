require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_URL found in environment or .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const query = `
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders' AND table_schema='public'
ORDER BY ordinal_position;
`;

(async () => {
  try {
    const res = await pool.query(query);
    console.log('Orders table columns:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying the database:', err.message || err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
})();

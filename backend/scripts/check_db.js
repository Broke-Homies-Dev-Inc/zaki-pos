require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_URL found in environment or .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const query = `
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name IN ('created_at','status','unit_price')
  AND table_schema='public'
ORDER BY table_name, column_name;
`;

(async () => {
  try {
    const res = await pool.query(query);
    if (res.rows.length === 0) {
      console.log('No matching columns found in the target database.');
    } else {
      console.log('Columns present in target DB:');
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error querying the database:', err.message || err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
})();

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_URL found in environment or .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const query = `
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name IN ('orders','order_items','restaurant_tables','menu_items')
  AND column_name IN ('id','order_id','menu_item_id','restaurant_table_id')
ORDER BY table_name, column_name;
`;

(async () => {
  try {
    const res = await pool.query(query);
    if (res.rows.length === 0) {
      console.log('No matching columns found in the target database.');
    } else {
      console.log('Column data types in target DB:');
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error querying the database:', err.message || err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
})();

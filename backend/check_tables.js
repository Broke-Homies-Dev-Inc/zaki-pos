// Check current table statuses
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function checkTables() {
  try {
    const result = await pool.query(
      "SELECT id, name, status FROM restaurant_tables ORDER BY name"
    );
    console.log('=== Current Table Statuses ===');
    result.rows.forEach(row => {
      console.log(`  ${row.name.padEnd(20)} → ${row.status || 'NULL'}`);
    });
    console.log('==============================');
    console.log(`Total tables: ${result.rows.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();

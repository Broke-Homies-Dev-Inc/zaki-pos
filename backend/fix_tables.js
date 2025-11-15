// Quick fix script to reset table statuses
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function fixTables() {
  try {
    const result = await pool.query(
      "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE status = 'paid' RETURNING id, name, status"
    );
    console.log('✅ Fixed', result.rowCount, 'tables:');
    result.rows.forEach(row => {
      console.log(`  - Table ${row.name} (ID: ${row.id}) → ${row.status}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTables();

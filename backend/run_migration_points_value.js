// Run migration to add points_value column
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration: add_points_value...');
    
    await client.query(`
      ALTER TABLE restaurant_settings 
      ADD COLUMN IF NOT EXISTS points_value DECIMAL(10, 2) DEFAULT 0.1;
    `);
    
    await client.query(`
      UPDATE restaurant_settings 
      SET points_value = 0.1 
      WHERE points_value IS NULL;
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added column: points_value (default: 0.1)');
    console.log('   - Default means: 10 points = ₹1');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

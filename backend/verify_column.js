// Verify points_value column exists
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function checkColumn() {
  try {
    // Check if column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_settings' 
      AND column_name = 'points_value';
    `);
    
    console.log('=== Column Check ===');
    if (columnCheck.rows.length > 0) {
      console.log('✅ points_value column exists');
      console.log('   Type:', columnCheck.rows[0].data_type);
      console.log('   Default:', columnCheck.rows[0].column_default);
    } else {
      console.log('❌ points_value column NOT found');
    }
    
    // Check current data
    const dataCheck = await pool.query(`
      SELECT id, loyalty_points_enabled, loyalty_points_per_100, points_value 
      FROM restaurant_settings;
    `);
    
    console.log('\n=== Current Settings ===');
    if (dataCheck.rows.length > 0) {
      console.log(dataCheck.rows[0]);
    } else {
      console.log('No settings rows found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumn();

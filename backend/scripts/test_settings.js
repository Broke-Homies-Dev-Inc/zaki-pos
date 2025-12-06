const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function testSettings() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing restaurant settings...\n');
    
    // Fetch current settings
    const result = await client.query('SELECT * FROM restaurant_settings LIMIT 1');
    
    if (result.rows.length === 0) {
      console.log('❌ No settings found in database');
    } else {
      console.log('✅ Current restaurant settings:');
      console.log('━'.repeat(60));
      const settings = result.rows[0];
      console.log(`Restaurant Name:      ${settings.restaurant_name}`);
      console.log(`Address:              ${settings.address}`);
      console.log(`Phone Number:         ${settings.contact_number}`);
      console.log(`Registration Number:  ${settings.registration_number || '(not set)'}`);
      console.log(`Tax Rate:             ${settings.tax_rate}%`);
      console.log('━'.repeat(60));
    }
    
    console.log('\n✅ Settings table is ready!');
    console.log('\n📝 To update settings:');
    console.log('   1. Start your backend server: npm run dev (in backend folder)');
    console.log('   2. Start your frontend: npm run dev (in frontend folder)');
    console.log('   3. Go to Settings > Restaurant Settings');
    console.log('   4. Update the values and click Save');
    console.log('   5. Print a bill to see the updated information');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testSettings();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function checkCustomers() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking customers in database...\n');
    
    const countResult = await client.query('SELECT COUNT(*) FROM customers');
    console.log(`Total Customers: ${countResult.rows[0].count}`);
    
    const customersResult = await client.query(`
      SELECT id, name, mobile_number, loyalty_points, created_at 
      FROM customers 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (customersResult.rows.length > 0) {
      console.log('\n📋 Customer List:');
      console.log('─────────────────────────────────────────────────────────');
      customersResult.rows.forEach(customer => {
        console.log(`ID: ${customer.id} | Name: ${customer.name} | Phone: ${customer.mobile_number} | Points: ${customer.loyalty_points || 0}`);
      });
    } else {
      console.log('\n❌ No customers found in database');
      console.log('💡 Customers will be created when orders are placed with phone numbers');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCustomers();

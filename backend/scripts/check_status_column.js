const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/restaurant_db';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Check if status column exists
    const colCheck = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'status'
    `);
    
    console.log('\n✅ Status Column Info:');
    console.log(colCheck.rows);
    
    // Check sample customers with status
    const customers = await client.query(`
      SELECT id, name, mobile_number, status, loyalty_points 
      FROM customers 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📊 Sample Customers:');
    customers.rows.forEach(c => {
      console.log(`  ID: ${c.id}, Name: ${c.name}, Phone: ${c.mobile_number || 'N/A'}, Status: ${c.status}, Points: ${c.loyalty_points}`);
    });
    
    // Count verified vs unverified
    const stats = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM customers 
      GROUP BY status
    `);
    
    console.log('\n📈 Customer Status Summary:');
    stats.rows.forEach(s => {
      console.log(`  ${s.status}: ${s.count} customers`);
    });
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

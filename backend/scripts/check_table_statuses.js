const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function checkTableStatuses() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking table statuses...\n');
    
    // Get all tables with their statuses and active orders
    const result = await client.query(`
      SELECT 
        rt.id, 
        rt.name, 
        rt.status,
        o.id AS order_id,
        o.order_number,
        o.status AS order_status
      FROM restaurant_tables rt
      LEFT JOIN orders o ON o.restaurant_table_id = rt.id AND o.status = 'pending'
      ORDER BY rt.name
    `);
    
    console.log('Current Table Statuses:');
    console.log('═'.repeat(80));
    console.log('Table Name'.padEnd(20) + 'Status'.padEnd(20) + 'Active Order'.padEnd(20) + 'Order Status');
    console.log('═'.repeat(80));
    
    for (const table of result.rows) {
      const statusColor = {
        'available': '⚪',
        'occupied': '🟡',
        'bill_printed': '🔵',
        'paid': '🟢'
      }[table.status] || '❓';
      
      console.log(
        table.name.padEnd(20) + 
        `${statusColor} ${table.status}`.padEnd(20) + 
        (table.order_number || 'None').padEnd(20) + 
        (table.order_status || '-')
      );
    }
    console.log('═'.repeat(80));
    
    // Check for inconsistencies
    console.log('\n🔍 Checking for inconsistencies...\n');
    
    const inconsistencies = result.rows.filter(table => {
      // If no active order but status is not 'available'
      if (!table.order_id && table.status !== 'available') {
        return true;
      }
      // If has active order but status is 'available'
      if (table.order_id && table.status === 'available') {
        return true;
      }
      return false;
    });
    
    if (inconsistencies.length > 0) {
      console.log('⚠️  Found inconsistencies:');
      for (const table of inconsistencies) {
        if (!table.order_id && table.status !== 'available') {
          console.log(`   - ${table.name}: Status is '${table.status}' but has no active order (should be 'available')`);
        }
        if (table.order_id && table.status === 'available') {
          console.log(`   - ${table.name}: Has active order ${table.order_number} but status is 'available' (should be 'occupied' or higher)`);
        }
      }
      
      console.log('\n🔧 Would you like to fix these? Run: node scripts/fix_table_statuses.js');
    } else {
      console.log('✅ All table statuses are consistent!');
    }
    
    // Show color legend
    console.log('\n📊 Status Colors:');
    console.log('   ⚪ Available  - No active order');
    console.log('   🟡 Occupied   - Order created');
    console.log('   🔵 Bill Printed - Bill has been printed');
    console.log('   🟢 Paid       - Payment completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableStatuses();

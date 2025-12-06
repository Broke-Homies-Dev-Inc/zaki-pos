const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function fixTableStatuses() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing table statuses...\n');
    
    // Reset tables with no active orders to 'available'
    const result = await client.query(`
      UPDATE restaurant_tables
      SET status = 'available', updated_at = NOW()
      WHERE id NOT IN (
        SELECT DISTINCT restaurant_table_id 
        FROM orders 
        WHERE status = 'pending' 
        AND restaurant_table_id IS NOT NULL
      )
      AND status != 'available'
      RETURNING name, status
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Fixed the following tables:');
      for (const table of result.rows) {
        console.log(`   - ${table.name} → 'available'`);
      }
    } else {
      console.log('✅ No tables needed fixing!');
    }
    
    console.log('\n📊 Current status summary:');
    const summary = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM restaurant_tables
      GROUP BY status
      ORDER BY status
    `);
    
    for (const row of summary.rows) {
      const emoji = {
        'available': '⚪',
        'occupied': '🟡',
        'bill_printed': '🔵',
        'paid': '🟢'
      }[row.status] || '❓';
      console.log(`   ${emoji} ${row.status}: ${row.count} tables`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTableStatuses();

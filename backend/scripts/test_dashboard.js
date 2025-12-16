const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function testDashboardStats() {
  const client = await pool.connect();
  try {
    console.log('📊 Testing Dashboard Statistics...\n');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's Revenue
    const todayRevenueResult = await client.query(
      `SELECT COALESCE(SUM(grand_total), 0) as revenue 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [today, tomorrow]
    );

    // Yesterday's Revenue
    const yesterdayRevenueResult = await client.query(
      `SELECT COALESCE(SUM(grand_total), 0) as revenue 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [yesterday, today]
    );

    // Today's Orders
    const todayOrdersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [today, tomorrow]
    );

    // New Customers Today
    const newCustomersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM customers 
       WHERE created_at >= $1 AND created_at < $2`,
      [today, tomorrow]
    );

    // Pending Orders
    const pendingOrdersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE status = 'pending'`
    );

    const todayRevenue = parseFloat(todayRevenueResult.rows[0].revenue);
    const yesterdayRevenue = parseFloat(yesterdayRevenueResult.rows[0].revenue);
    const revenueChangeNum = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100)
      : 0;

    console.log('═'.repeat(60));
    console.log('📈 Dashboard Statistics');
    console.log('═'.repeat(60));
    console.log(`Today's Revenue:     ${todayRevenue.toFixed(2)} (${revenueChangeNum > 0 ? '+' : ''}${revenueChangeNum.toFixed(1)}% from yesterday)`);
    console.log(`Yesterday's Revenue: ${yesterdayRevenue.toFixed(2)}`);
    console.log('─'.repeat(60));
    console.log(`Today's Orders:      ${todayOrdersResult.rows[0].count}`);
    console.log(`New Customers:       ${newCustomersResult.rows[0].count}`);
    console.log(`Pending Orders:      ${pendingOrdersResult.rows[0].count}`);
    console.log('═'.repeat(60));

    console.log('\n✅ Dashboard endpoint should return these statistics');
    console.log('🔗 Endpoint: GET http://localhost:4000/api/dashboard');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testDashboardStats();

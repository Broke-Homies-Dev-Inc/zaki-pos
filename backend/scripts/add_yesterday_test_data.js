const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function addYesterdayTestData() {
  const client = await pool.connect();
  try {
    console.log('📝 Adding test data for yesterday...\n');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 30, 0, 0); // 10:30 AM yesterday
    
    await client.query('BEGIN');
    
    // Create a test customer
    const customerResult = await client.query(
      'INSERT INTO customers (name, mobile_number, created_at) VALUES ($1, $2, $3) RETURNING id',
      ['Test Customer Yesterday', '1234567890', yesterday]
    );
    const customerId = customerResult.rows[0].id;
    
    // Create test orders for yesterday
    const orders = [
      { amount: 500.00, items: 2 },
      { amount: 750.50, items: 3 },
      { amount: 425.00, items: 2 }
    ];
    
    for (const orderData of orders) {
      const orderNumber = `ORD-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      await client.query(
        `INSERT INTO orders 
         (order_number, customer_id, order_type, subtotal, tax_amount, grand_total, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orderNumber,
          customerId,
          'dine_in',
          orderData.amount,
          orderData.amount * 0.05, // 5% tax
          orderData.amount * 1.05,
          'completed',
          yesterday,
          yesterday
        ]
      );
    }
    
    await client.query('COMMIT');
    
    const totalYesterday = orders.reduce((sum, o) => sum + (o.amount * 1.05), 0);
    
    console.log('✅ Test data added successfully!');
    console.log('─'.repeat(60));
    console.log(`Yesterday's Orders: ${orders.length}`);
    console.log(`Yesterday's Revenue: ${totalYesterday.toFixed(2)}`);
    console.log('─'.repeat(60));
    
    // Now fetch today's data for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayResult = await client.query(
      `SELECT COALESCE(SUM(grand_total), 0) as revenue, COUNT(*) as count
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [today, tomorrow]
    );
    
    const todayRevenue = parseFloat(todayResult.rows[0].revenue);
    const todayOrders = parseInt(todayResult.rows[0].count);
    
    console.log('\n📊 Comparison:');
    console.log('─'.repeat(60));
    console.log(`Today's Revenue:     ${todayRevenue.toFixed(2)}`);
    console.log(`Yesterday's Revenue: ${totalYesterday.toFixed(2)}`);
    
    if (totalYesterday > 0) {
      const revenueChange = ((todayRevenue - totalYesterday) / totalYesterday * 100);
      console.log(`Change: ${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%`);
    }
    
    console.log('');
    console.log(`Today's Orders:      ${todayOrders}`);
    console.log(`Yesterday's Orders:  ${orders.length}`);
    
    if (orders.length > 0) {
      const ordersChange = ((todayOrders - orders.length) / orders.length * 100);
      console.log(`Change: ${ordersChange > 0 ? '+' : ''}${ordersChange.toFixed(1)}%`);
    }
    console.log('─'.repeat(60));
    
    console.log('\n✅ Now you can test the dashboard with real comparison data!');
    console.log('🔗 Visit: http://localhost:3000 (after starting both servers)');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addYesterdayTestData();

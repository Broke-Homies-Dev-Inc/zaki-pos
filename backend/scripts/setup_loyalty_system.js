const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function setupLoyaltySystem() {
  const client = await pool.connect();
  try {
    console.log('🎁 Setting up Loyalty Points System...\n');
    
    await client.query('BEGIN');
    
    // 1. Add loyalty_points column to customers table
    console.log('1. Adding loyalty_points to customers table...');
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
    `);
    console.log('   ✅ Added loyalty_points column');
    
    // 2. Add loyalty settings to restaurant_settings table
    console.log('\n2. Adding loyalty settings to restaurant_settings...');
    await client.query(`
      ALTER TABLE restaurant_settings 
      ADD COLUMN IF NOT EXISTS loyalty_points_enabled BOOLEAN DEFAULT true;
    `);
    await client.query(`
      ALTER TABLE restaurant_settings 
      ADD COLUMN IF NOT EXISTS loyalty_points_per_100 INTEGER DEFAULT 10;
    `);
    console.log('   ✅ Added loyalty_points_enabled column (default: true)');
    console.log('   ✅ Added loyalty_points_per_100 column (default: 10 points per ₹100)');
    
    // 3. Create loyalty_transactions table for tracking point history
    console.log('\n3. Creating loyalty_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        points_earned INTEGER DEFAULT 0,
        points_redeemed INTEGER DEFAULT 0,
        transaction_type VARCHAR(20) CHECK (transaction_type IN ('earned', 'redeemed', 'adjustment')),
        description TEXT,
        order_amount DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Created loyalty_transactions table');
    
    // 4. Create index for faster queries
    console.log('\n4. Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_loyalty_customer 
      ON loyalty_transactions(customer_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_loyalty_order 
      ON loyalty_transactions(order_id);
    `);
    console.log('   ✅ Created indexes');
    
    // 5. Update restaurant_settings with default loyalty settings
    console.log('\n5. Setting default loyalty configuration...');
    const settingsCheck = await client.query('SELECT id FROM restaurant_settings LIMIT 1');
    if (settingsCheck.rows.length > 0) {
      await client.query(`
        UPDATE restaurant_settings 
        SET loyalty_points_enabled = true, 
            loyalty_points_per_100 = 10
        WHERE id = $1
      `, [settingsCheck.rows[0].id]);
      console.log('   ✅ Updated existing settings with loyalty defaults');
    }
    
    await client.query('COMMIT');
    
    // Show summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Loyalty Points System Setup Complete!');
    console.log('═'.repeat(60));
    
    // Display current configuration
    const config = await client.query(`
      SELECT loyalty_points_enabled, loyalty_points_per_100 
      FROM restaurant_settings LIMIT 1
    `);
    
    if (config.rows.length > 0) {
      console.log('\n📊 Current Configuration:');
      console.log(`   Loyalty System: ${config.rows[0].loyalty_points_enabled ? 'Enabled ✅' : 'Disabled ❌'}`);
      console.log(`   Points per ₹100: ${config.rows[0].loyalty_points_per_100}`);
    }
    
    // Show customer stats
    const customerStats = await client.query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE loyalty_points > 0) as customers_with_points,
        COALESCE(SUM(loyalty_points), 0) as total_points
      FROM customers
    `);
    
    console.log('\n👥 Customer Stats:');
    console.log(`   Total Customers: ${customerStats.rows[0].total_customers}`);
    console.log(`   Customers with Points: ${customerStats.rows[0].customers_with_points}`);
    console.log(`   Total Points Issued: ${customerStats.rows[0].total_points}`);
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Start backend: npm run dev');
    console.log('   2. Navigate to Settings → Loyalty Points');
    console.log('   3. Configure points per ₹100 spent');
    console.log('   4. Create orders with customer phone numbers to earn points!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

setupLoyaltySystem();

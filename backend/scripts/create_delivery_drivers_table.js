const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_URL found in environment or .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function createDeliveryDriversTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating delivery_drivers table...');
    
    // Create delivery_drivers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        vehicle_type VARCHAR(50),
        vehicle_number VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_delivery', 'on_break')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT delivery_drivers_employee_id_key UNIQUE (employee_id)
      );
    `);
    
    console.log('✓ delivery_drivers table created');
    
    // Create index on status for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_delivery_drivers_status 
      ON delivery_drivers(status);
    `);
    
    console.log('✓ Index created on status');
    
    // Create trigger for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_delivery_drivers_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_delivery_drivers_updated_at ON delivery_drivers;
      CREATE TRIGGER trigger_update_delivery_drivers_updated_at
        BEFORE UPDATE ON delivery_drivers
        FOR EACH ROW
        EXECUTE FUNCTION update_delivery_drivers_updated_at();
    `);
    
    console.log('✓ Updated_at trigger created');
    
    // Add delivery_driver_id column to orders table if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'orders' AND column_name = 'delivery_driver_id'
        ) THEN
          ALTER TABLE orders ADD COLUMN delivery_driver_id UUID REFERENCES delivery_drivers(id);
          CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver_id ON orders(delivery_driver_id);
        END IF;
      END $$;
    `);
    
    console.log('✓ delivery_driver_id column added to orders table');
    
    // Create view for active delivery drivers with stats
    await client.query(`
      CREATE OR REPLACE VIEW active_delivery_driver_orders AS
      SELECT 
        dd.id AS delivery_driver_id,
        dd.name,
        dd.employee_id,
        dd.phone_number,
        dd.vehicle_type,
        dd.vehicle_number,
        dd.status,
        COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'preparing')) AS active_orders,
        COUNT(o.id) FILTER (WHERE o.status = 'completed' AND o.created_at::date = CURRENT_DATE) AS completed_today,
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at::date = CURRENT_DATE THEN o.grand_total ELSE 0 END), 0) AS sales_today
      FROM delivery_drivers dd
      LEFT JOIN orders o ON dd.id = o.delivery_driver_id AND o.order_type = 'delivery'
      WHERE dd.status IN ('active', 'on_delivery', 'on_break')
      GROUP BY dd.id, dd.name, dd.employee_id, dd.phone_number, dd.vehicle_type, dd.vehicle_number, dd.status;
    `);
    
    console.log('✓ View active_delivery_driver_orders created');
    
    // Insert sample delivery drivers (optional)
    await client.query(`
      INSERT INTO delivery_drivers (name, employee_id, phone_number, vehicle_type, vehicle_number, status)
      VALUES 
        ('Ahmed Ali', 'DD001', '+968-9123-4567', 'Motorcycle', 'DD-1234', 'active'),
        ('Sarah Johnson', 'DD002', '+968-9234-5678', 'Car', 'DD-5678', 'active')
      ON CONFLICT (employee_id) DO NOTHING;
    `);
    
    console.log('✓ Sample delivery drivers inserted');
    
    await client.query('COMMIT');
    console.log('\n✅ Delivery drivers table setup completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting up delivery_drivers table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
createDeliveryDriversTable()
  .then(() => {
    console.log('Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

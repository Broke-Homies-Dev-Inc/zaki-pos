require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

const alterStatements = [
  // Add missing columns to orders table
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0 NOT NULL;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0 NOT NULL;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10,2) DEFAULT 0 NOT NULL;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_table_id INTEGER;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS take_away_method TEXT;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS car_details TEXT;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();`,
  
  // Add missing columns to other tables we saw errors for earlier
  `ALTER TABLE floors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`,
  `ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`,
  `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();`,
  `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' NOT NULL;`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);`,
  
  // Backfill unit_price from menu_items where missing
  `UPDATE order_items oi SET unit_price = mi.price FROM menu_items mi WHERE oi.menu_item_id = mi.id AND (oi.unit_price IS NULL OR oi.unit_price = 0);`,
  
  // Backfill unit_price from total_price/quantity as fallback
  `UPDATE order_items SET unit_price = (total_price / NULLIF(quantity, 0)) WHERE unit_price IS NULL OR unit_price = 0;`,
];

(async () => {
  console.log('🔧 Applying schema fixes to match your SQL dump...\n');
  
  for (const statement of alterStatements) {
    try {
      console.log(`Running: ${statement.substring(0, 80)}...`);
      await pool.query(statement);
      console.log('✅ Success\n');
    } catch (err) {
      console.error(`❌ Error: ${err.message}\n`);
    }
  }
  
  console.log('🎉 Schema migration complete!');
  await pool.end();
})();

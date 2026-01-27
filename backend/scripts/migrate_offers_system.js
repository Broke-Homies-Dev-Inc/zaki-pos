require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function migrateOffersSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🎯 Starting Offers System Migration...\n');

    await client.query('BEGIN');

    // =========================================================
    // Step 1: Update offers table structure
    // =========================================================
    console.log('1. Updating offers table structure...');
    
    await client.query(`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS offer_type TEXT,
      ADD COLUMN IF NOT EXISTS discount_type TEXT,
      ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS is_stackable BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
    `);
    
    console.log('   ✅ Added offer_type, discount_type, discount_value columns');
    console.log('   ✅ Added priority, is_stackable columns');
    console.log('   ✅ Added start_time, end_time columns');

    // Ensure combos are explicitly non-stackable
    await client.query(`
      UPDATE offers
      SET is_stackable = false
      WHERE offer_type = 'COMBO';
    `);
    console.log('   ✅ Set combos as non-stackable');

    // =========================================================
    // Step 2: Create combos table
    // =========================================================
    console.log('\n2. Creating combos table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS combos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_id INTEGER NOT NULL REFERENCES offers(id),
        name TEXT NOT NULL,
        fixed_price NUMERIC(10,2) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('   ✅ Created combos table');

    // =========================================================
    // Step 3: Create combo_items table
    // =========================================================
    console.log('\n3. Creating combo_items table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS combo_items (
        combo_id UUID NOT NULL REFERENCES combos(id),
        menu_item_id UUID NOT NULL REFERENCES menu_items(id),
        quantity INTEGER NOT NULL,
        PRIMARY KEY (combo_id, menu_item_id)
      );
    `);
    console.log('   ✅ Created combo_items table');

    // =========================================================
    // Step 4: Update orders table
    // =========================================================
    console.log('\n4. Updating orders table...');
    
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS applied_combo_id UUID REFERENCES combos(id),
      ADD COLUMN IF NOT EXISTS has_combo BOOLEAN DEFAULT false;
    `);
    console.log('   ✅ Added applied_combo_id and has_combo columns');

    // Mark existing orders correctly (safe backfill)
    await client.query(`
      UPDATE orders
      SET has_combo = true
      WHERE applied_combo_id IS NOT NULL;
    `);
    console.log('   ✅ Backfilled has_combo flag for existing orders');

    // Prevent more than one combo per order (no combo stacking)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_combo_per_order
      ON orders (id)
      WHERE applied_combo_id IS NOT NULL;
    `);
    console.log('   ✅ Created unique constraint for combo per order');

    // =========================================================
    // Step 5: Update order_items table
    // =========================================================
    console.log('\n5. Updating order_items table...');
    
    await client.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS applied_offer_source TEXT;
    `);
    console.log('   ✅ Added applied_offer_source column');

    // =========================================================
    // Step 6: Rename item_offers to item_offers_legacy
    // =========================================================
    console.log('\n6. Deprecating legacy item_offers table...');
    
    // Check if item_offers table exists
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'item_offers'
      );
    `);
    
    if (rows[0].exists) {
      // Check if item_offers_legacy already exists
      const { rows: legacyRows } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'item_offers_legacy'
        );
      `);
      
      if (!legacyRows[0].exists) {
        await client.query(`
          ALTER TABLE item_offers
          RENAME TO item_offers_legacy;
        `);
        console.log('   ✅ Renamed item_offers to item_offers_legacy');
      } else {
        console.log('   ⚠️  item_offers_legacy already exists, skipping rename');
      }
    } else {
      console.log('   ℹ️  item_offers table does not exist, skipping rename');
    }

    // =========================================================
    // Step 7: Create indexes for performance
    // =========================================================
    console.log('\n7. Creating performance indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_offers_active_window
      ON offers (active, start_time, end_time);
    `);
    console.log('   ✅ Created index for active offers with time window');

    await client.query('COMMIT');
    
    console.log('\n✅ Offers System Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  - Extended offers table with flexible discount options');
    console.log('  - Created combos and combo_items tables');
    console.log('  - Updated orders table to support combo tracking');
    console.log('  - Added offer source tracking to order_items');
    console.log('  - Deprecated legacy item_offers table');
    console.log('  - Added performance indexes\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    console.error('\nStack trace:', err.stack);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
migrateOffersSystem()
  .then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration process failed:', err);
    process.exit(1);
  });

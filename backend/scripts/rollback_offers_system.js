require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function rollbackOffersSystem() {
  const client = await pool.connect();
  
  try {
    console.log('⏪ Starting Offers System Rollback...\n');
    console.log('⚠️  WARNING: This will undo all offers system migrations!\n');

    await client.query('BEGIN');

    // =========================================================
    // Step 1: Drop performance indexes
    // =========================================================
    console.log('1. Removing performance indexes...');
    
    await client.query(`
      DROP INDEX IF EXISTS idx_offers_active_window;
    `);
    console.log('   ✅ Dropped idx_offers_active_window index');

    // =========================================================
    // Step 2: Restore item_offers table from legacy
    // =========================================================
    console.log('\n2. Restoring item_offers table...');
    
    // Check if item_offers_legacy exists
    const { rows: legacyRows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'item_offers_legacy'
      );
    `);
    
    if (legacyRows[0].exists) {
      // Check if item_offers already exists (shouldn't, but be safe)
      const { rows: itemOffersRows } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'item_offers'
        );
      `);
      
      if (itemOffersRows[0].exists) {
        console.log('   ⚠️  item_offers already exists, dropping it first');
        await client.query(`DROP TABLE item_offers CASCADE;`);
      }
      
      await client.query(`
        ALTER TABLE item_offers_legacy
        RENAME TO item_offers;
      `);
      console.log('   ✅ Restored item_offers table from legacy');
    } else {
      console.log('   ℹ️  item_offers_legacy does not exist, nothing to restore');
    }

    // =========================================================
    // Step 3: Remove applied_offer_source column from order_items
    // =========================================================
    console.log('\n3. Removing order_items modifications...');
    
    await client.query(`
      ALTER TABLE order_items
      DROP COLUMN IF EXISTS applied_offer_source;
    `);
    console.log('   ✅ Removed applied_offer_source column');

    // =========================================================
    // Step 4: Remove unique constraint and columns from orders
    // =========================================================
    console.log('\n4. Removing orders table modifications...');
    
    await client.query(`
      DROP INDEX IF EXISTS unique_combo_per_order;
    `);
    console.log('   ✅ Dropped unique_combo_per_order index');
    
    await client.query(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS has_combo,
      DROP COLUMN IF EXISTS applied_combo_id;
    `);
    console.log('   ✅ Removed has_combo and applied_combo_id columns');

    // =========================================================
    // Step 5: Drop combo_items table
    // =========================================================
    console.log('\n5. Dropping combo_items table...');
    
    await client.query(`
      DROP TABLE IF EXISTS combo_items CASCADE;
    `);
    console.log('   ✅ Dropped combo_items table');

    // =========================================================
    // Step 6: Drop combos table
    // =========================================================
    console.log('\n6. Dropping combos table...');
    
    await client.query(`
      DROP TABLE IF EXISTS combos CASCADE;
    `);
    console.log('   ✅ Dropped combos table');

    // =========================================================
    // Step 7: Remove new columns from offers table
    // =========================================================
    console.log('\n7. Removing offers table modifications...');
    
    await client.query(`
      ALTER TABLE offers
      DROP COLUMN IF EXISTS end_time,
      DROP COLUMN IF EXISTS start_time,
      DROP COLUMN IF EXISTS is_stackable,
      DROP COLUMN IF EXISTS priority,
      DROP COLUMN IF EXISTS discount_value,
      DROP COLUMN IF EXISTS discount_type,
      DROP COLUMN IF EXISTS offer_type;
    `);
    console.log('   ✅ Removed all new columns from offers table');

    await client.query('COMMIT');
    
    console.log('\n✅ Offers System Rollback completed successfully!\n');
    console.log('Summary:');
    console.log('  - Removed performance indexes');
    console.log('  - Restored item_offers from legacy');
    console.log('  - Removed offer source tracking from order_items');
    console.log('  - Removed combo tracking from orders');
    console.log('  - Dropped combo_items table');
    console.log('  - Dropped combos table');
    console.log('  - Removed new columns from offers table');
    console.log('\nThe database has been restored to its pre-migration state.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Rollback failed:', err.message);
    console.error('\nStack trace:', err.stack);
    console.error('\n⚠️  Database may be in an inconsistent state. Please review manually.\n');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the rollback
rollbackOffersSystem()
  .then(() => {
    console.log('Rollback process completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Rollback process failed:', err);
    process.exit(1);
  });

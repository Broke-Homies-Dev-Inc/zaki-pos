const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/restaurant_db';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('🖨️  Adding print_preview_enabled column to restaurant_settings...');

    // Add print_preview_enabled column (default true to maintain current behavior)
    await client.query(`
      ALTER TABLE restaurant_settings 
      ADD COLUMN IF NOT EXISTS print_preview_enabled BOOLEAN DEFAULT true
    `);
    console.log('✅ Added print_preview_enabled column (default: true)');

    // Check current state
    const result = await client.query('SELECT print_preview_enabled FROM restaurant_settings LIMIT 1');
    if (result.rows.length > 0) {
      console.log(`📊 Current print preview setting: ${result.rows[0].print_preview_enabled ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.log('ℹ️  No restaurant settings found yet (will use default: enabled)');
    }

    console.log('✅ Print preview setting migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) main();

const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/restaurant_db';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Adding customers.status column (if missing) and migrating values...');

    await client.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unverified'`);
    console.log('- Ensured customers.status column exists');

    // Mark existing customers with a phone number as verified
    await client.query(`UPDATE customers SET status = 'verified' WHERE mobile_number IS NOT NULL AND mobile_number <> ''`);
    console.log("- Marked customers with mobile_number as 'verified'");

    // Optional: create an index for faster lookups by status
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`);
    console.log('- Ensured index on customers.status');

    console.log('Customer status migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) main();

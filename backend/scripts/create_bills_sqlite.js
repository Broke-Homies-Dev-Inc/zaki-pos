const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db.sqlite3');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔧 Creating bills table if not exists in SQLite DB:', dbPath);
  // Enable FK checks
  db.run('PRAGMA foreign_keys = ON;');

  // Create the bills table. SQLite doesn't have native UUID or enum types, so we use TEXT
  // and a CHECK constraint for payment_method. Amounts use NUMERIC to preserve scale.
  db.run(`
		CREATE TABLE IF NOT EXISTS bills (
			id TEXT PRIMARY KEY,
			order_id TEXT NOT NULL,
			bill_number TEXT NOT NULL UNIQUE,
			payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','digital','due','other')),
			amount_paid NUMERIC NOT NULL,
			change_due NUMERIC NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			customer_id TEXT,
			FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT,
			FOREIGN KEY(customer_id) REFERENCES customers(id)
		);
	`, (err) => {
    if (err) console.error('❌ Error creating bills table:', err.message);
    else console.log('✅ bills table created or already exists');
  });

  // Create index for order_id for faster lookups (not strictly required but useful)
  db.run(`CREATE INDEX IF NOT EXISTS idx_bills_order_id ON bills(order_id);`, (err) => {
    if (err) console.error('❌ Error creating index idx_bills_order_id:', err.message);
    else console.log('✅ idx_bills_order_id created or already exists');
  });
});

db.close();


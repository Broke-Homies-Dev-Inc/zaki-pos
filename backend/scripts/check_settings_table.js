const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:1234@localhost:5432/restaurant_db'
});

async function checkSettingsTable() {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'restaurant_settings'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ restaurant_settings table does not exist');
      console.log('Creating restaurant_settings table...');
      
      await client.query(`
        CREATE TABLE restaurant_settings (
          id SERIAL PRIMARY KEY,
          restaurant_name VARCHAR(255),
          address TEXT,
          contact_number VARCHAR(50),
          registration_number VARCHAR(100),
          tax_rate DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('✅ Created restaurant_settings table');
      
      // Insert default settings
      await client.query(`
        INSERT INTO restaurant_settings (restaurant_name, address, contact_number, registration_number, tax_rate)
        VALUES ('My Restaurant', '123 Main Street', '555-0100', '', 0);
      `);
      
      console.log('✅ Inserted default settings');
      return;
    }
    
    console.log('✅ restaurant_settings table exists');
    
    // Check columns
    const columnsCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_settings' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent columns:');
    columnsCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    const columnNames = columnsCheck.rows.map(c => c.column_name);
    const alterStatements = [];
    
    // Check and add missing columns
    if (!columnNames.includes('registration_number')) {
      alterStatements.push("ALTER TABLE restaurant_settings ADD COLUMN registration_number VARCHAR(100) DEFAULT '';");
    }
    if (!columnNames.includes('tax_rate')) {
      alterStatements.push("ALTER TABLE restaurant_settings ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;");
    }
    if (!columnNames.includes('created_at')) {
      alterStatements.push("ALTER TABLE restaurant_settings ADD COLUMN created_at TIMESTAMP DEFAULT NOW();");
    }
    if (!columnNames.includes('updated_at')) {
      alterStatements.push("ALTER TABLE restaurant_settings ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();");
    }
    
    if (alterStatements.length > 0) {
      console.log('\n🔧 Adding missing columns...');
      for (const stmt of alterStatements) {
        console.log(`  ${stmt}`);
        await client.query(stmt);
      }
      console.log('✅ All missing columns added');
    } else {
      console.log('\n✅ All required columns exist');
    }
    
    // Show current settings
    const settings = await client.query('SELECT * FROM restaurant_settings LIMIT 1');
    if (settings.rows.length === 0) {
      console.log('\n⚠️  No settings found, inserting defaults...');
      await client.query(`
        INSERT INTO restaurant_settings (restaurant_name, address, contact_number, registration_number, tax_rate)
        VALUES ('My Restaurant', '123 Main Street', '555-0100', '', 0);
      `);
      console.log('✅ Default settings inserted');
    } else {
      console.log('\nCurrent settings:');
      console.log(settings.rows[0]);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSettingsTable();

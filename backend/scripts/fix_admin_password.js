// Fix admin password hash
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('No DATABASE_URL found in environment or .env');
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function fixAdminPassword() {
    const client = await pool.connect();
    try {
        // Generate proper bcrypt hash for 'admin123'
        const password_hash = await bcrypt.hash('admin123', 10);
        console.log('Generated password hash for admin123');

        // Update admin user
        await client.query(
            "UPDATE users SET password_hash = $1 WHERE username = 'admin'",
            [password_hash]
        );
        console.log('✅ Admin password updated successfully!');

    } catch (error) {
        console.error('❌ Failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

fixAdminPassword();

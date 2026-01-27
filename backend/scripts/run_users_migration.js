// Run the users and roles migration
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('No DATABASE_URL found in environment or .env');
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
    const client = await pool.connect();
    try {
        const migrationPath = path.join(__dirname, '..', 'migrations', 'add_users_and_roles.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration: add_users_and_roles.sql');
        await client.query(sql);
        console.log('✅ Migration completed successfully!');

        // Verify by checking if tables exist
        const rolesResult = await client.query('SELECT COUNT(*) FROM roles');
        console.log(`   - Roles table has ${rolesResult.rows[0].count} rows`);

        const usersResult = await client.query('SELECT COUNT(*) FROM users');
        console.log(`   - Users table has ${usersResult.rows[0].count} rows`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();

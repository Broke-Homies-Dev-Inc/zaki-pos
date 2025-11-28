#!/usr/bin/env node

/**
 * PostgreSQL to SQLite Schema Migration Script
 * 
 * This script:
 * 1. Connects to PostgreSQL database (zaki_db)
 * 2. Extracts all table schemas
 * 3. Converts PostgreSQL DDL to SQLite-compatible DDL
 * 4. Creates tables in db.sqlite3
 * 
 * Usage: node scripts/migrate_pg_to_sqlite.js
 */

const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Configuration
const PG_CONNECTION = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/restaurant_db';
const SQLITE_DB_PATH = path.join(__dirname, '..', 'db.sqlite3');

// PostgreSQL to SQLite type mapping
const TYPE_MAP = {
    // Integer types
    'integer': 'INTEGER',
    'bigint': 'INTEGER',
    'smallint': 'INTEGER',
    'serial': 'INTEGER',
    'bigserial': 'INTEGER',

    // Text types
    'character varying': 'TEXT',
    'varchar': 'TEXT',
    'text': 'TEXT',
    'char': 'TEXT',
    'character': 'TEXT',

    // Numeric types
    'numeric': 'REAL',
    'decimal': 'REAL',
    'real': 'REAL',
    'double precision': 'REAL',
    'money': 'REAL',

    // Boolean
    'boolean': 'INTEGER',

    // Date/Time
    'timestamp without time zone': 'DATETIME',
    'timestamp with time zone': 'DATETIME',
    'timestamp': 'DATETIME',
    'date': 'DATE',
    'time': 'TIME',

    // UUID (stored as text in SQLite)
    'uuid': 'TEXT',

    // JSON
    'json': 'TEXT',
    'jsonb': 'TEXT',

    // Arrays (stored as JSON text in SQLite)
    'ARRAY': 'TEXT',
};

/**
 * Convert PostgreSQL data type to SQLite type
 */
function mapPostgresToSQLite(pgType, udtName) {
    // Handle array types
    if (pgType === 'ARRAY' || udtName?.startsWith('_')) {
        return 'TEXT';
    }

    // Direct mapping
    const mapped = TYPE_MAP[pgType.toLowerCase()] || TYPE_MAP[udtName?.toLowerCase()];
    if (mapped) return mapped;

    // Default to TEXT for unknown types
    console.warn(`⚠️  Unknown type: ${pgType} (${udtName}), defaulting to TEXT`);
    return 'TEXT';
}

/**
 * Get all tables from PostgreSQL
 */
async function getPostgresTables(pgClient) {
    const result = await pgClient.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
    return result.rows.map(row => row.tablename);
}

/**
 * Get table schema from PostgreSQL
 */
async function getTableSchema(pgClient, tableName) {
    // Get column information
    const columnsResult = await pgClient.query(`
    SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

    // Get primary key information
    const pkResult = await pgClient.query(`
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary
  `, [tableName]);

    const primaryKeys = pkResult.rows.map(row => row.attname);

    // Get unique constraints
    const uniqueResult = await pgClient.query(`
    SELECT 
      c.conname AS constraint_name,
      string_agg(a.attname, ',') AS columns_str
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = $1::regclass 
      AND c.contype = 'u'
    GROUP BY c.conname
  `, [tableName]);

    // Convert columns_str to array
    const uniqueConstraints = uniqueResult.rows.map(row => ({
        constraint_name: row.constraint_name,
        columns: row.columns_str.split(',')
    }));

    // Get foreign keys
    const fkResult = await pgClient.query(`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `, [tableName]);

    // Get check constraints
    const checkResult = await pgClient.query(`
    SELECT 
      conname,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass
      AND contype = 'c'
  `, [tableName]);

    return {
        columns: columnsResult.rows,
        primaryKeys,
        uniqueConstraints: uniqueConstraints,
        foreignKeys: fkResult.rows,
        checkConstraints: checkResult.rows,
    };
}

/**
 * Generate SQLite CREATE TABLE statement
 */
function generateSQLiteCreateTable(tableName, schema) {
    const { columns, primaryKeys, uniqueConstraints, foreignKeys, checkConstraints } = schema;

    let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    const columnDefs = [];
    const tableLevelConstraints = [];

    // Add columns
    for (const col of columns) {
        let colDef = `  ${col.column_name}`;

        // Data type
        const sqliteType = mapPostgresToSQLite(col.data_type, col.udt_name);
        colDef += ` ${sqliteType}`;

        // Primary key (single column)
        if (primaryKeys.length === 1 && primaryKeys.includes(col.column_name)) {
            colDef += ' PRIMARY KEY';

            // Auto-increment for integer primary keys
            if (sqliteType === 'INTEGER' && col.column_default?.includes('nextval')) {
                colDef += ' AUTOINCREMENT';
            }
        }

        // NOT NULL
        if (col.is_nullable === 'NO' && !primaryKeys.includes(col.column_name)) {
            colDef += ' NOT NULL';
        }

        // Default value (clean up PostgreSQL-specific syntax)
        if (col.column_default && !col.column_default.includes('nextval')) {
            let defaultValue = col.column_default;

            // Skip PostgreSQL functions that don't exist in SQLite
            if (defaultValue.includes('gen_random_uuid()') ||
                defaultValue.includes('uuid_generate_v4()')) {
                // Skip UUID generation - SQLite will use NULL or app-generated values
                continue;
            }

            // Handle common PostgreSQL default patterns
            defaultValue = defaultValue.replace(/::[\w\s]+/g, ''); // Remove type casts
            defaultValue = defaultValue.replace(/now\(\)/gi, "CURRENT_TIMESTAMP");
            defaultValue = defaultValue.replace(/CURRENT_TIMESTAMP/gi, "CURRENT_TIMESTAMP");
            defaultValue = defaultValue.replace(/true/gi, '1');
            defaultValue = defaultValue.replace(/false/gi, '0');

            // Only add if not empty after cleanup
            if (defaultValue.trim() && defaultValue.trim() !== '') {
                colDef += ` DEFAULT ${defaultValue}`;
            }
        }

        // Unique constraint (column level)
        const uniqueOnThisCol = uniqueConstraints.find(uc =>
            uc.columns.length === 1 && uc.columns.includes(col.column_name)
        );
        if (uniqueOnThisCol) {
            colDef += ' UNIQUE';
        }

        columnDefs.push(colDef);
    }

    // Composite primary key
    if (primaryKeys.length > 1) {
        tableLevelConstraints.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
    }

    // Multi-column unique constraints
    for (const uc of uniqueConstraints) {
        if (uc.columns.length > 1) {
            tableLevelConstraints.push(`  UNIQUE (${uc.columns.join(', ')})`);
        }
    }

    // Foreign keys
    for (const fk of foreignKeys) {
        const onDelete = fk.delete_rule === 'CASCADE' ? ' ON DELETE CASCADE' :
            fk.delete_rule === 'SET NULL' ? ' ON DELETE SET NULL' :
                fk.delete_rule === 'RESTRICT' ? ' ON DELETE RESTRICT' : '';
        const onUpdate = fk.update_rule === 'CASCADE' ? ' ON UPDATE CASCADE' : '';

        tableLevelConstraints.push(
            `  FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})${onDelete}${onUpdate}`
        );
    }

    // Check constraints (extract the actual check condition)
    for (const check of checkConstraints) {
        // Extract the CHECK clause from the definition
        const match = check.definition.match(/CHECK\s*\((.*)\)/i);
        if (match) {
            let condition = match[1];

            // Skip complex PostgreSQL-specific checks (like ARRAY or ANY)
            if (condition.includes('ARRAY') ||
                condition.includes('ANY') ||
                condition.includes('::')) {
                console.warn(`   ⚠️  Skipping complex CHECK constraint: ${check.conname}`);
                continue;
            }

            // Convert PostgreSQL-specific syntax to SQLite
            condition = condition.replace(/\(\((\w+)\)\)::text/g, '$1'); // Simplify text casts
            tableLevelConstraints.push(`  CHECK (${condition})`);
        }
    }

    // Combine all definitions
    const allDefs = [...columnDefs, ...tableLevelConstraints];
    sql += allDefs.join(',\n');
    sql += '\n)';

    return sql;
}

/**
 * Get existing table schema from SQLite
 */
function getSQLiteTableSchema(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Check if table exists in SQLite
 */
function tableExists(db, tableName) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [tableName],
            (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            }
        );
    });
}

/**
 * Create table in SQLite
 */
function createSQLiteTable(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Execute SQL statement in SQLite
 */
function executeSQLite(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Compare schemas and generate ALTER TABLE statements
 */
function compareAndGenerateAlters(pgSchema, sqliteSchema, tableName) {
    const alterStatements = [];
    const existingColumns = new Map(sqliteSchema.map(col => [col.name, col]));

    // Check for new or modified columns
    for (const pgCol of pgSchema.columns) {
        const sqliteCol = existingColumns.get(pgCol.column_name);
        const sqliteType = mapPostgresToSQLite(pgCol.data_type, pgCol.udt_name);

        if (!sqliteCol) {
            // Column doesn't exist - need to add it
            let alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${pgCol.column_name} ${sqliteType}`;

            // Add NOT NULL only if there's a default value (SQLite requirement)
            const hasDefault = pgCol.column_default &&
                !pgCol.column_default.includes('nextval') &&
                !pgCol.column_default.includes('gen_random_uuid()');

            if (hasDefault) {
                let defaultValue = pgCol.column_default;
                defaultValue = defaultValue.replace(/::[\w\s]+/g, '');
                defaultValue = defaultValue.replace(/now\(\)/gi, "CURRENT_TIMESTAMP");
                defaultValue = defaultValue.replace(/true/gi, '1');
                defaultValue = defaultValue.replace(/false/gi, '0');

                if (defaultValue.trim()) {
                    alterSQL += ` DEFAULT ${defaultValue}`;

                    // Can only add NOT NULL if there's a default
                    if (pgCol.is_nullable === 'NO') {
                        alterSQL += ' NOT NULL';
                    }
                }
            }

            alterStatements.push(alterSQL);
        }
        // Note: SQLite doesn't support modifying existing columns easily
        // Would need to recreate table to change column types
    }

    return alterStatements;
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('🚀 PostgreSQL to SQLite Schema Migration\n');
    console.log(`📊 Source: ${PG_CONNECTION.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`📁 Target: ${SQLITE_DB_PATH}\n`);

    const pgClient = new Client({ connectionString: PG_CONNECTION });
    const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH);

    try {
        // Connect to PostgreSQL
        console.log('🔌 Connecting to PostgreSQL...');
        await pgClient.connect();
        console.log('✅ Connected to PostgreSQL\n');

        // Enable foreign keys in SQLite
        await new Promise((resolve, reject) => {
            sqliteDb.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Get all tables
        console.log('📋 Fetching table list...');
        const tables = await getPostgresTables(pgClient);
        console.log(`✅ Found ${tables.length} tables\n`);

        // Process each table
        for (const tableName of tables) {
            console.log(`\n📦 Processing table: ${tableName}`);

            try {
                // Get schema
                console.log(`   ↳ Extracting PostgreSQL schema...`);
                const schema = await getTableSchema(pgClient, tableName);
                console.log(`   ↳ Found ${schema.columns.length} columns`);

                // Check if table exists in SQLite
                const exists = await tableExists(sqliteDb, tableName);

                if (exists) {
                    console.log(`   ℹ️  Table already exists, checking for schema changes...`);

                    // Get existing SQLite schema
                    const sqliteSchema = await getSQLiteTableSchema(sqliteDb, tableName);

                    // Compare and generate ALTER statements
                    const alterStatements = compareAndGenerateAlters(schema, sqliteSchema, tableName);

                    if (alterStatements.length > 0) {
                        console.log(`   🔄 Applying ${alterStatements.length} schema change(s):`);

                        for (const alterSQL of alterStatements) {
                            console.log(`      - ${alterSQL}`);
                            try {
                                await executeSQLite(sqliteDb, alterSQL);
                                console.log(`      ✅ Applied successfully`);
                            } catch (alterErr) {
                                console.error(`      ❌ Failed: ${alterErr.message}`);
                            }
                        }
                    } else {
                        console.log(`   ✅ Schema is up to date (no changes needed)`);
                    }
                } else {
                    // Table doesn't exist - create it
                    console.log(`   ↳ Generating SQLite DDL...`);
                    const createTableSQL = generateSQLiteCreateTable(tableName, schema);

                    // Log the SQL for review
                    console.log(`\n${'─'.repeat(80)}`);
                    console.log(createTableSQL);
                    console.log('─'.repeat(80));

                    // Create table in SQLite
                    console.log(`   ↳ Creating table in SQLite...`);
                    await createSQLiteTable(sqliteDb, createTableSQL);
                    console.log(`   ✅ Table ${tableName} created successfully`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing table ${tableName}:`, error.message);
                // Continue with next table instead of failing completely
            }
        }

        console.log('\n\n🎉 Migration completed!\n');

        // Verify tables in SQLite
        await new Promise((resolve, reject) => {
            sqliteDb.all(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        console.log('📊 Tables created in SQLite:');
                        rows.forEach(row => console.log(`   ✓ ${row.name}`));
                        console.log(`\nTotal: ${rows.length} tables\n`);
                        resolve();
                    }
                }
            );
        });

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        // Cleanup
        await pgClient.end();
        sqliteDb.close();
        console.log('👋 Connections closed\n');
    }
}

// Run migration
if (require.main === module) {
    migrate().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { migrate };

#!/usr/bin/env node

/**
 * Check database for floors, sections, and tables
 * Useful for verifying orphaned records
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/zaki_db'
});

async function checkLayout() {
  console.log('🔍 Checking database layout...\n');
  
  try {
    // Check floors
    const floorsResult = await pool.query('SELECT id, name, created_at FROM floors ORDER BY created_at');
    console.log('📊 FLOORS:');
    console.log('─'.repeat(80));
    if (floorsResult.rows.length === 0) {
      console.log('   (No floors found)');
    } else {
      floorsResult.rows.forEach(floor => {
        console.log(`   ID: ${floor.id}`);
        console.log(`   Name: ${floor.name}`);
        console.log(`   Created: ${floor.created_at}`);
        console.log('   ' + '─'.repeat(76));
      });
    }
    console.log(`   Total: ${floorsResult.rows.length} floor(s)\n`);

    // Check sections
    const sectionsResult = await pool.query(`
      SELECT s.id, s.name, s.floor_id, f.name as floor_name, s.created_at 
      FROM sections s
      LEFT JOIN floors f ON s.floor_id = f.id
      ORDER BY s.created_at
    `);
    console.log('📊 SECTIONS:');
    console.log('─'.repeat(80));
    if (sectionsResult.rows.length === 0) {
      console.log('   (No sections found)');
    } else {
      sectionsResult.rows.forEach(section => {
        console.log(`   ID: ${section.id}`);
        console.log(`   Name: ${section.name}`);
        console.log(`   Floor: ${section.floor_name || 'ORPHANED (floor_id: ' + section.floor_id + ')'}`);
        console.log(`   Created: ${section.created_at}`);
        console.log('   ' + '─'.repeat(76));
      });
    }
    console.log(`   Total: ${sectionsResult.rows.length} section(s)\n`);

    // Check tables
    const tablesResult = await pool.query(`
      SELECT 
        t.id, 
        t.name, 
        t.section_id, 
        s.name as section_name,
        t.status,
        t.created_at 
      FROM restaurant_tables t
      LEFT JOIN sections s ON t.section_id = s.id
      ORDER BY t.created_at
    `);
    console.log('📊 RESTAURANT TABLES:');
    console.log('─'.repeat(80));
    if (tablesResult.rows.length === 0) {
      console.log('   (No tables found)');
    } else {
      tablesResult.rows.forEach(table => {
        console.log(`   ID: ${table.id}`);
        console.log(`   Name: ${table.name}`);
        console.log(`   Section: ${table.section_name || '⚠️  ORPHANED (section_id: ' + table.section_id + ')'}`);
        console.log(`   Status: ${table.status}`);
        console.log(`   Created: ${table.created_at}`);
        console.log('   ' + '─'.repeat(76));
      });
    }
    console.log(`   Total: ${tablesResult.rows.length} table(s)\n`);

    // Check for orphaned tables
    const orphanedTablesResult = await pool.query(`
      SELECT t.id, t.name, t.section_id
      FROM restaurant_tables t
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE s.id IS NULL
    `);
    
    if (orphanedTablesResult.rows.length > 0) {
      console.log('⚠️  ORPHANED TABLES (tables with no section):');
      console.log('─'.repeat(80));
      orphanedTablesResult.rows.forEach(table => {
        console.log(`   ⚠️  ${table.name} (ID: ${table.id}, section_id: ${table.section_id})`);
      });
      console.log(`   Total: ${orphanedTablesResult.rows.length} orphaned table(s)\n`);
      
      console.log('💡 To clean up orphaned tables, run:');
      console.log(`   DELETE FROM restaurant_tables WHERE section_id NOT IN (SELECT id FROM sections);\n`);
    } else {
      console.log('✅ No orphaned tables found\n');
    }

    // Summary
    console.log('📈 SUMMARY:');
    console.log('─'.repeat(80));
    console.log(`   Floors: ${floorsResult.rows.length}`);
    console.log(`   Sections: ${sectionsResult.rows.length}`);
    console.log(`   Tables: ${tablesResult.rows.length}`);
    console.log(`   Orphaned Tables: ${orphanedTablesResult.rows.length}`);
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLayout();

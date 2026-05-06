import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env variables first
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

// Ensure DATABASE_URL is clean of quotes
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('"')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
}

// Now dynamically import the DB module so env vars are set
const db = await import('../api/_db.js');

async function migrate() {
  console.log('Starting migration from local-data.json to Supabase Postgres...');
  
  const dataPath = path.join(__dirname, '../local-data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('local-data.json not found!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  console.log('Initializing DB...');
  await db.initDb();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Migrate Settings
    if (data.companySettings) {
      console.log('Migrating companySettings...');
      await db.writeSettings(data.companySettings);
    }

    // Migrate Tables
    const tables = {
      customers: 'customers',
      employees: 'employees',
      employeeTransactions: 'employee_transactions',
      vehicles: 'vehicles',
      slips: 'slips',
      transactions: 'transactions',
      invoices: 'invoices',
      tasks: 'tasks',
      auditLogs: 'audit_logs'
    };

    for (const [jsonKey, dbTable] of Object.entries(tables)) {
      const records = data[jsonKey];
      if (Array.isArray(records) && records.length > 0) {
        console.log(`Migrating ${records.length} records to ${dbTable}...`);
        for (const record of records) {
          await db.upsertRecord(client, dbTable, record);
        }
      } else {
        console.log(`No records for ${jsonKey}`);
      }
    }

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

migrate();

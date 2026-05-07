import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('"')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
}

async function check() {
  const db = await import('../api/_db.js');
  const res = await db.pool.query("SELECT data FROM settings WHERE id = 'global'");
  console.log(JSON.stringify(res.rows[0]?.data?.users, null, 2));
  await db.pool.end();
}
check();

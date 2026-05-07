import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('"')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
}

async function checkAuth() {
  const db = await import('../api/_db.js');
  try {
    const res = await db.pool.query("SELECT id, email, raw_user_meta_data FROM auth.users");
    console.log("AUTH USERS:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error querying auth.users:", (err as Error).message);
  }
  await db.pool.end();
}
checkAuth();

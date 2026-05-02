/**
 * One-time migration: creates existing companySettings.users in Supabase Auth
 * and updates their IDs in local-data.json to the Supabase UUIDs.
 *
 * Run once: npx tsx scripts/migrate-users.ts
 *
 * For each user, a temporary password is set. The user or Admin must
 * change it via Settings → Change My Password (or Admin Reset Password).
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'local-data.json');

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  passwordHash?: string;
  [key: string]: unknown;
};

async function migrate() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  const settings = data.companySettings ?? {};
  const users: UserAccount[] = settings.users ?? [];

  if (users.length === 0) {
    console.log('No users to migrate.');
    return;
  }

  console.log(`\nMigrating ${users.length} user(s) to Supabase Auth...\n`);

  // Check existing Supabase users to avoid duplicates.
  const { data: existing } = await admin.auth.admin.listUsers();
  const existingEmails = new Set((existing?.users ?? []).map((u) => u.email?.toLowerCase()));

  const updatedUsers: UserAccount[] = [];
  const tempPasswords: { name: string; email: string; tempPassword: string }[] = [];

  for (const user of users) {
    const email = user.email.toLowerCase();

    // Skip if already in Supabase (matched by email).
    if (existingEmails.has(email)) {
      const existing_user = existing?.users.find((u) => u.email?.toLowerCase() === email);
      if (existing_user) {
        console.log(`  SKIP  ${email} (already exists as ${existing_user.id})`);
        const { passwordHash: _ph, ...rest } = user;
        updatedUsers.push({ ...rest, id: existing_user.id });
        continue;
      }
    }

    // Generate a temporary password.
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: { role: user.role },
    });

    if (error || !created?.user) {
      console.error(`  ERROR ${email}:`, error?.message ?? 'unknown');
      const { passwordHash: _ph, ...rest } = user;
      updatedUsers.push(rest);
      continue;
    }

    console.log(`  OK    ${email} → ${created.user.id}  (role: ${user.role})`);
    tempPasswords.push({ name: user.name, email, tempPassword });

    // Use Supabase UUID, drop passwordHash.
    const { passwordHash: _ph, ...rest } = user;
    updatedUsers.push({ ...rest, id: created.user.id });
  }

  // Write updated settings back.
  data.companySettings = { ...settings, users: updatedUsers };
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tempFile, DATA_FILE);

  console.log('\n✓ local-data.json updated with Supabase UUIDs.\n');

  if (tempPasswords.length > 0) {
    console.log('Temporary passwords (share securely — users must change on first login):');
    console.log('─'.repeat(60));
    for (const { name, email, tempPassword } of tempPasswords) {
      console.log(`  ${name} <${email}>`);
      console.log(`  Password: ${tempPassword}`);
      console.log();
    }
    console.log('─'.repeat(60));
    console.log('After logging in, go to Settings → Users → Change My Password.\n');
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

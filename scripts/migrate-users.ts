/**
 * One-time/repair migration: creates configured app users in Supabase Auth
 * and updates stored companySettings.users IDs to the Supabase Auth UUIDs.
 *
 * Run:
 *   npx tsx scripts/migrate-users.ts
 *
 * Sources repaired:
 *   - local-data.json, used by the local Express dev server
 *   - Supabase Postgres settings row, used by the deployed /api/data handler
 *
 * For each newly-created Auth user, a temporary password is printed once.
 * Users should change that password after the first successful login.
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'local-data.json');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const resetPassword = process.env.MIGRATED_USER_PASSWORD?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

if (resetPassword && resetPassword.length < 8) {
  console.error('MIGRATED_USER_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type UserRole = 'Admin' | 'Manager' | 'Partner';
type UserStatus = 'Active' | 'Inactive';

type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  passwordHash?: string;
  [key: string]: unknown;
};

type SettingsSource = {
  label: string;
  settings: Record<string, unknown>;
  users: UserAccount[];
  save: (settings: Record<string, unknown>) => Promise<void>;
};

const ROLE_PRIORITY: Record<UserRole, number> = {
  Partner: 1,
  Manager: 2,
  Admin: 3,
};

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRole(value: unknown): value is UserRole {
  return value === 'Admin' || value === 'Manager' || value === 'Partner';
}

function isStatus(value: unknown): value is UserStatus {
  return value === 'Active' || value === 'Inactive';
}

function cleanUser(user: UserAccount): UserAccount {
  const { passwordHash: _passwordHash, ...rest } = user;
  return {
    ...rest,
    email: normaliseEmail(user.email),
    role: isRole(user.role) ? user.role : 'Partner',
    status: isStatus(user.status) ? user.status : 'Active',
  };
}

function mergeUser(existing: UserAccount | undefined, next: UserAccount): UserAccount {
  if (!existing) return cleanUser(next);

  const existingRole = isRole(existing.role) ? existing.role : 'Partner';
  const nextRole = isRole(next.role) ? next.role : 'Partner';
  const role =
    ROLE_PRIORITY[nextRole] > ROLE_PRIORITY[existingRole] ? nextRole : existingRole;

  return cleanUser({
    ...existing,
    name: existing.name || next.name,
    email: normaliseEmail(existing.email || next.email),
    role,
    status: existing.status === 'Active' || next.status === 'Active' ? 'Active' : 'Inactive',
  });
}

async function loadLocalSource(): Promise<SettingsSource | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const settings = data.companySettings ?? {};
    const users = Array.isArray(settings.users) ? settings.users.map(cleanUser) : [];

    return {
      label: 'local-data.json',
      settings,
      users,
      save: async (updatedSettings) => {
        data.companySettings = updatedSettings;
        const tempFile = `${DATA_FILE}.tmp`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
        await fs.rename(tempFile, DATA_FILE);
      },
    };
  } catch (error) {
    console.warn(`Could not read local-data.json: ${String(error)}`);
    return null;
  }
}

async function loadDatabaseSource(pool: pg.Pool | null): Promise<SettingsSource | null> {
  if (!pool) return null;

  const { rows } = await pool.query('SELECT data FROM settings WHERE id = $1', ['global']);
  if (!rows[0]?.data) return null;

  const settings =
    typeof rows[0].data === 'string'
      ? JSON.parse(rows[0].data)
      : (rows[0].data as Record<string, unknown>);
  const users = Array.isArray(settings.users) ? settings.users.map(cleanUser) : [];

  return {
    label: 'Supabase settings',
    settings,
    users,
    save: async (updatedSettings) => {
      const cleaned = {
        ...updatedSettings,
        users: Array.isArray(updatedSettings.users)
          ? (updatedSettings.users as UserAccount[]).map(cleanUser)
          : updatedSettings.users,
      };

      await pool.query(
        'INSERT INTO settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
        ['global', JSON.stringify(cleaned)],
      );
    },
  };
}

function collectUsers(sources: SettingsSource[]): Map<string, UserAccount> {
  const usersByEmail = new Map<string, UserAccount>();

  for (const source of sources) {
    for (const user of source.users) {
      if (!user.email) continue;
      const email = normaliseEmail(user.email);
      usersByEmail.set(email, mergeUser(usersByEmail.get(email), user));
    }
  }

  return usersByEmail;
}

function generateTempPassword(): string {
  return `Temp${Math.random().toString(36).slice(2, 10)}!`;
}

async function migrate() {
  const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 10_000,
      })
    : null;

  try {
    const sources = (await Promise.all([
      loadLocalSource(),
      loadDatabaseSource(pool),
    ])).filter(Boolean) as SettingsSource[];

    if (sources.length === 0) {
      console.log('No local or database settings source was found.');
      return;
    }

    const usersByEmail = collectUsers(sources);
    if (usersByEmail.size === 0) {
      console.log('No configured users found to migrate.');
      return;
    }

    console.log(`\nMigrating ${usersByEmail.size} unique user(s) to Supabase Auth...\n`);

    const { data: existing, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const authUsersByEmail = new Map(
      (existing?.users ?? [])
        .filter((user) => user.email)
        .map((user) => [normaliseEmail(user.email!), user]),
    );

    const tempPasswords: { name: string; email: string; tempPassword: string }[] = [];

    for (const [email, user] of usersByEmail) {
      const existingUser = authUsersByEmail.get(email);

      if (existingUser) {
        const updatePayload: {
          user_metadata: { name: string };
          app_metadata: { role: UserRole };
          password?: string;
        } = {
          user_metadata: { name: user.name },
          app_metadata: { role: user.role },
        };

        if (resetPassword) updatePayload.password = resetPassword;

        const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
          ...updatePayload,
        });
        if (error) {
          console.error(`  ERROR ${email}: ${error.message}`);
          continue;
        }
        console.log(
          `  OK    ${email} already exists as ${existingUser.id}` +
            (resetPassword ? '  (password reset)' : ''),
        );
        continue;
      }

      const tempPassword = resetPassword || generateTempPassword();
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: user.name },
        app_metadata: { role: user.role },
      });

      if (error || !created?.user) {
        console.error(`  ERROR ${email}: ${error?.message ?? 'unknown error'}`);
        continue;
      }

      authUsersByEmail.set(email, created.user);
      if (!resetPassword) tempPasswords.push({ name: user.name, email, tempPassword });
      console.log(`  OK    ${email} -> ${created.user.id}  (role: ${user.role})`);
    }

    for (const source of sources) {
      const sourceUsersByEmail = new Map(
        source.users.map((user) => [normaliseEmail(user.email), user]),
      );
      const orderedEmails = Array.from(
        new Set([
          ...source.users.map((user) => normaliseEmail(user.email)),
          ...usersByEmail.keys(),
        ]),
      );

      const updatedUsers = orderedEmails.flatMap((email) => {
        const user = sourceUsersByEmail.get(email) ?? usersByEmail.get(email);
        if (!user) return [];
        const authUser = authUsersByEmail.get(normaliseEmail(user.email));
        return authUser ? cleanUser({ ...user, id: authUser.id }) : cleanUser(user);
      });

      await source.save({ ...source.settings, users: updatedUsers });
      console.log(`\nUpdated ${source.label} user IDs.`);
    }

    if (resetPassword) {
      console.log(`\nAll migrated active users now use temporary password: ${resetPassword}`);
      console.log('Change it from Settings after first successful login.');
    }

    if (tempPasswords.length > 0) {
      console.log('\nTemporary passwords. Store securely and change after first login:');
      console.log('-'.repeat(72));
      for (const { name, email, tempPassword } of tempPasswords) {
        console.log(`${name} <${email}>`);
        console.log(`Password: ${tempPassword}`);
        console.log();
      }
      console.log('-'.repeat(72));
    }
  } finally {
    await pool?.end();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

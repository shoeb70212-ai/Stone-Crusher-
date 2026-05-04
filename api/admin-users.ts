/**
 * Vercel Serverless handler for admin user management.
 *
 * All write operations require a valid Supabase Bearer token from an Admin
 * user in companySettings.  Bootstrap mode (first-run) skips auth but only
 * when no users exist yet.
 *
 * Routes:
 *   POST   /api/admin-users   — create user (or bootstrap first admin)
 *   PATCH  /api/admin-users   — update role / status / reset password
 *   DELETE /api/admin-users   — delete user by id (query param)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, verifyBearerToken } from './_supabase-admin.js';
import { initDb, readSettings, writeSettings } from './_db.js';
import type { UserAccount } from './_types.js';

const ALLOWED_ORIGINS = new Set([
  'https://stone-crusher.vercel.app',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:8083',
  // Capacitor Android WebView origin
  'https://localhost',
  'capacitor://localhost',
]);

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers['origin'] as string | undefined;
  if (!origin) return '*';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'null';
}

function isValidRole(value: unknown): value is UserAccount['role'] {
  return value === 'Admin' || value === 'Manager' || value === 'Partner';
}

function isValidStatus(value: unknown): value is UserAccount['status'] {
  return value === 'Active' || value === 'Inactive';
}

function hasActiveAdmin(users: UserAccount[]): boolean {
  return users.some((u) => u.role === 'Admin' && u.status === 'Active');
}

/** Resolves whether the caller is an Admin in companySettings. */
async function resolveCallerRole(
  req: VercelRequest,
): Promise<{ isAdmin: boolean; userId: string } | null> {
  const caller = await verifyBearerToken(req);
  if (!caller) return null;

  const settings = await readSettings();
  const users = (settings.users ?? []) as UserAccount[];
  const callerUser = users.find(
    (u) => u.id === caller.userId || u.email.toLowerCase() === (caller.email || '').toLowerCase(),
  );
  if (!callerUser || callerUser.status !== 'Active') return null;

  return { isAdmin: callerUser.role === 'Admin', userId: caller.userId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Authorization',
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initDb();
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Database init failed', details: String(err) });
  }

  // -----------------------------------------------------------------------
  // POST — Create a new user (or bootstrap the very first admin)
  // -----------------------------------------------------------------------
  if (req.method === 'POST') {
    const { email, password, name, role, bootstrap } = req.body ?? {};

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role are required.' });
    }
    if (!isValidRole(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const settings = await readSettings();
    const existingUsers = (settings.users ?? []) as UserAccount[];

    if (bootstrap) {
      // Bootstrap is only allowed when there are no users yet.
      if (existingUsers.length > 0) {
        return res.status(403).json({ error: 'Bootstrap is not allowed after users exist.' });
      }
    } else {
      // All non-bootstrap requests require an authenticated Admin.
      const caller = await resolveCallerRole(req);
      if (!caller?.isAdmin) {
        return res.status(403).json({ error: 'Only Admins can create users.' });
      }
    }

    // Duplicate email check.
    const dup = existingUsers.find(
      (u) => u.email.toLowerCase() === (email as string).toLowerCase(),
    );
    if (dup) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    // Create the user in Supabase Auth.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: (email as string).toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role, status: 'Active' },
    });

    if (authError) {
      console.error('Supabase createUser error:', authError);
      return res.status(500).json({ error: authError.message });
    }

    // Store user metadata in companySettings — no password hash.
    const newUser: UserAccount = {
      id: authData.user.id,
      name: (name as string).trim(),
      email: (email as string).toLowerCase(),
      role: role as UserAccount['role'],
      status: 'Active',
    };

    const updatedSettings = {
      ...settings,
      users: [...existingUsers, newUser],
    };
    await writeSettings(updatedSettings);

    return res.status(201).json({ user: newUser });
  }

  // -----------------------------------------------------------------------
  // PATCH — Update role, status, or reset password for an existing user
  // -----------------------------------------------------------------------
  if (req.method === 'PATCH') {
    const caller = await resolveCallerRole(req);
    if (!caller?.isAdmin) {
      return res.status(403).json({ error: 'Only Admins can update users.' });
    }

    const { id, name, email, role, status, password } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required.' });
    if (role && !isValidRole(role)) return res.status(400).json({ error: 'Invalid role.' });
    if (status && !isValidStatus(status)) return res.status(400).json({ error: 'Invalid status.' });

    const settings = await readSettings();
    const users = (settings.users ?? []) as UserAccount[];
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const nextUser: UserAccount = {
      ...target,
      ...(name ? { name: (name as string).trim() } : {}),
      ...(email ? { email: (email as string).trim().toLowerCase() } : {}),
      ...(role ? { role: role as UserAccount['role'] } : {}),
      ...(status ? { status: status as UserAccount['status'] } : {}),
    };

    if (nextUser.status === 'Inactive' && id === caller.userId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    if (
      nextUser.email !== target.email &&
      users.some((u) => u.id !== id && u.email.toLowerCase() === nextUser.email.toLowerCase())
    ) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const updatedUsers = users.map((u) => (u.id === id ? nextUser : u));
    if (!hasActiveAdmin(updatedUsers)) {
      return res.status(400).json({ error: 'At least one active Admin account is required.' });
    }

    const authUpdate: Record<string, unknown> = {};
    if (password) {
      if ((password as string).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      authUpdate.password = password;
    }
    if (nextUser.email !== target.email) {
      authUpdate.email = nextUser.email;
      authUpdate.email_confirm = true;
    }
    if (nextUser.name !== target.name) authUpdate.user_metadata = { name: nextUser.name };
    if (role || status) {
      authUpdate.app_metadata = { role: nextUser.role, status: nextUser.status };
      authUpdate.ban_duration = nextUser.status === 'Inactive' ? '876000h' : 'none';
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
      if (updateError) {
        console.error('Supabase updateUser error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }
    }

    // Update companySettings.users.
    await writeSettings({ ...settings, users: updatedUsers });

    return res.status(200).json({ user: updatedUsers.find((u) => u.id === id) });
  }

  // -----------------------------------------------------------------------
  // DELETE — Remove a user from Supabase Auth and companySettings
  // -----------------------------------------------------------------------
  if (req.method === 'DELETE') {
    const caller = await resolveCallerRole(req);
    if (!caller?.isAdmin) {
      return res.status(403).json({ error: 'Only Admins can delete users.' });
    }

    const id = req.query['id'] as string | undefined;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    // Prevent self-deletion.
    if (id === caller.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const settings = await readSettings();
    const users = (settings.users ?? []) as UserAccount[];
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const remainingUsers = users.filter((u) => u.id !== id);
    if (!hasActiveAdmin(remainingUsers)) {
      return res.status(400).json({ error: 'At least one active Admin account is required.' });
    }

    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (delError) {
      console.error('Supabase deleteUser error:', delError);
      return res.status(500).json({ error: delError.message });
    }

    await writeSettings({ ...settings, users: remainingUsers });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

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
import { supabaseAdmin, verifyBearerToken } from './_supabase-admin';
import { initDb, readSettings, writeSettings } from './_db';

const ALLOWED_ORIGINS = new Set([
  'https://stone-crusher.vercel.app',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:8083',
]);

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers['origin'] as string | undefined;
  if (!origin) return '*';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'null';
}

type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Partner';
  status: 'Active' | 'Inactive';
};

/** Resolves whether the caller is an Admin in companySettings. */
async function resolveCallerRole(
  req: VercelRequest,
): Promise<{ isAdmin: boolean; userId: string } | null> {
  const caller = await verifyBearerToken(req);
  if (!caller) return null;

  const settings = await readSettings();
  const users = (settings.users ?? []) as UserAccount[];
  const callerUser = users.find(
    (u) => u.id === caller.userId || u.email.toLowerCase() === caller.email.toLowerCase(),
  );
  if (!callerUser) return null;

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
      app_metadata: { role },
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

    const { id, role, status, password } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required.' });

    const settings = await readSettings();
    const users = (settings.users ?? []) as UserAccount[];
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Apply password reset in Supabase Auth if provided.
    if (password) {
      if ((password as string).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (pwError) {
        console.error('Supabase updateUser error:', pwError);
        return res.status(500).json({ error: pwError.message });
      }
    }

    // Apply metadata changes in Supabase Auth.
    if (role || status) {
      const appMeta: Record<string, unknown> = {};
      if (role) appMeta.role = role;
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        app_metadata: appMeta,
        ...(status === 'Inactive' ? { ban_duration: 'none' } : {}),
      });
      if (metaError) {
        console.error('Supabase updateUser meta error:', metaError);
        return res.status(500).json({ error: metaError.message });
      }
    }

    // Update companySettings.users.
    const updatedUsers = users.map((u) =>
      u.id === id
        ? {
            ...u,
            ...(role ? { role: role as UserAccount['role'] } : {}),
            ...(status ? { status: status as UserAccount['status'] } : {}),
          }
        : u,
    );
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

    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (delError) {
      console.error('Supabase deleteUser error:', delError);
      return res.status(500).json({ error: delError.message });
    }

    const settings = await readSettings();
    const users = (settings.users ?? []) as UserAccount[];
    await writeSettings({ ...settings, users: users.filter((u) => u.id !== id) });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

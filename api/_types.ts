/** Shared types used across API route handlers. */

export type UserRole = 'Admin' | 'Manager' | 'Partner';

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
};

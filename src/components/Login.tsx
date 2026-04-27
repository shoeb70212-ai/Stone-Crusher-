import React, { useState } from 'react';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { companySettings, setUserRole } = useErp();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Default admin fallback if no users are set up
    const hasUsers = companySettings.users && companySettings.users.length > 0;
    
    if (!hasUsers) {
      if (email === 'admin@admin.com' && password === 'admin123') {
        setUserRole('Admin');
        localStorage.setItem('erp_auth_token', 'mock_token_admin');
        onLogin();
        return;
      }
    } else {
      // In a real app, this would verify a hash or use an Auth provider like Firebase.
      // For this offline-first version, we match the email against companySettings.users.
      const user = companySettings.users?.find(u => u.email === email && u.status === 'Active');
      
      if (user) {
        // We assume password is valid for now since we don't store passwords in settings.
        // If they enter *any* password and the email exists, we let them in (mock auth).
        if (password.length >= 6) {
          setUserRole(user.role);
          localStorage.setItem('erp_auth_token', `mock_token_${user.id}`);
          onLogin();
          return;
        } else {
          setError('Password must be at least 6 characters.');
          return;
        }
      }
    }

    setError('Invalid email or password. (Default: admin@admin.com / admin123)');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden border border-zinc-100 dark:border-zinc-700">
        <div className="bg-primary-600 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CrushTrack ERP</h1>
          <p className="text-primary-100 mt-2 text-sm">Sign in to manage your operations</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
              {error}
            </div>
          )}
          
          <div className="space-y-1 relative">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-zinc-900 dark:text-white"
                placeholder="admin@admin.com"
              />
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-zinc-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 rounded-xl transition-colors shadow-sm shadow-primary-600/20"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Database, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

interface ServerSettingsScreenProps {
  onBack: () => void;
}

export function ServerSettingsScreen({ onBack }: ServerSettingsScreenProps) {
  const [url, setUrl] = useState(supabaseUrl || '');
  const [key, setKey] = useState(supabaseAnonKey || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) localStorage.setItem('supabaseUrl', url.trim());
    else localStorage.removeItem('supabaseUrl');

    if (key) localStorage.setItem('supabaseAnonKey', key.trim());
    else localStorage.removeItem('supabaseAnonKey');

    setIsSaved(true);
    // Reload the page to re-initialize the Supabase client with new keys
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      <div className="md:flex-1 relative bg-primary-600 dark:bg-primary-700 flex flex-col items-center justify-center px-6 md:px-12 lg:px-16 py-8 md:py-12 shrink-0 md:min-h-screen">
        <div className="relative flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-elev-md">
            <Database className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight leading-tight">
            Database Settings
          </h1>
          <p className="text-primary-100 mt-2 text-sm md:text-base max-w-xs">
            Configure your Supabase connection URL and Anon Key to access your ERP data.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-surface md:bg-background rounded-t-3xl md:rounded-none -mt-5 md:mt-0 px-6 pt-8 pb-8 md:pt-0 md:pb-6 md:px-12 lg:px-16 flex flex-col justify-center overflow-y-auto">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            Connection Details
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-7">
            Enter your custom database credentials below. These are stored locally on this device.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="supabaseUrl"
                className="block text-xs font-semibold text-foreground tracking-wide"
              >
                Supabase Project URL
              </label>
              <input
                id="supabaseUrl"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full h-12 px-4 text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                placeholder="https://your-project.supabase.co"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="supabaseAnonKey"
                className="block text-xs font-semibold text-foreground tracking-wide"
              >
                Supabase Anon Key
              </label>
              <textarea
                id="supabaseAnonKey"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full h-24 p-4 text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground resize-none"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
              />
            </div>

            <div className="bg-warning-muted text-warning-foreground p-3 rounded-xl text-xs flex items-start gap-2 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Saving these settings will immediately reload the application to apply the new connection.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSaved}
              className={`w-full h-12 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm mt-4 flex items-center justify-center gap-2 ${
                isSaved ? 'bg-success hover:bg-success' : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.99]'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Saved & Reloading...
                </>
              ) : (
                'Save Connection'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

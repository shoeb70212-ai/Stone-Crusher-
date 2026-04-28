import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRetry(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRetry(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRetry) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-2 px-4 flex items-center justify-center gap-2"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4" />
      <span className="text-sm font-medium">You're offline. Changes will sync when connected.</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-4 px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition-colors flex items-center gap-1"
        aria-label="Refresh page"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div 
      className="flex items-center gap-1.5 text-xs"
      role="status"
      aria-label={isOnline ? 'Connected' : 'Disconnected'}
    >
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span className="text-zinc-500 dark:text-zinc-400">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
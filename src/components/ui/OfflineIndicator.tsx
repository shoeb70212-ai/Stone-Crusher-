import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { isNative } from '../../lib/capacitor';
import { hapticsWarning } from '../../lib/haptics';

interface OfflineIndicatorProps {
  /** Called when the device comes back online so callers can flush their sync queue. */
  onReconnect?: () => void;
}

export function OfflineIndicator({ onReconnect }: OfflineIndicatorProps = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRetry, setShowRetry] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setShowRetry(false);
    onReconnect?.();
  }, [onReconnect]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setShowRetry(true);
    hapticsWarning();
  }, []);

  useEffect(() => {
    if (isNative()) {
      // Use @capacitor/network for reliable cross-platform background events
      let cleanup: (() => void) | undefined;

      import('@capacitor/network').then(({ Network }) => {
        // Sync initial state
        Network.getStatus().then((status) => {
          if (!status.connected) handleOffline();
        });

        Network.addListener('networkStatusChange', (status) => {
          if (status.connected) {
            handleOnline();
          } else {
            handleOffline();
          }
        }).then((handle) => {
          cleanup = () => handle.remove();
        });
      });

      return () => cleanup?.();
    }

    // Web: use standard browser events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

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


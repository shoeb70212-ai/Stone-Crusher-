import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { isNative } from '../../lib/capacitor';
import { hapticsWarning } from '../../lib/haptics';

interface OfflineIndicatorProps {
  /** Called when the device comes back online so callers can flush their sync queue. */
  onReconnect?: () => void | Promise<unknown>;
  /** Current sync status from ErpContext. */
  syncStatus?: 'idle' | 'syncing' | 'error' | 'failed';
  /** Called when the user presses the Retry button in failed state. */
  onRetry?: () => void;
  /** Number of pending changes (for the failed banner). */
  pendingCount?: number;
}

export function OfflineIndicator({
  onReconnect,
  syncStatus,
  onRetry,
  pendingCount = 0,
}: OfflineIndicatorProps = {}) {
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
      let cleanup: (() => void) | undefined;
      import('@capacitor/network').then(({ Network }) => {
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
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  if (syncStatus === 'failed') {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-rose-600 text-white py-2 px-4 flex items-center justify-center gap-3"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">
          {pendingCount} change{pendingCount === 1 ? '' : 's'} pending. Sync failed.
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition-colors flex items-center gap-1"
            aria-label="Retry sync"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

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


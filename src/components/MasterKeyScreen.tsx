import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { deriveKeyFromPassword, encryptData, decryptData, exportMasterKey } from '../lib/crypto-utils';
import { setMasterKey } from '../lib/sync-engine';
import { Lock, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * MasterKeyScreen
 * 
 * Shown after Supabase login. The user must enter the Master Password to
 * unlock the E2EE vault. The derived AES key is held in memory only.
 * 
 * First-time flow:  User sets a new Master Password → salt + verification token stored in Supabase.
 * Returning flow:   User enters existing Master Password → verified against stored token.
 */

const SYSTEM_COLLECTION = '__system__';
const SALT_RECORD_ID = '__vault_salt__';
const VERIFY_PLAINTEXT = 'CRUSHTRACK_VAULT_OK'; // Known string to verify correct password

interface MasterKeyScreenProps {
  onUnlocked: () => void;
}

export default function MasterKeyScreen({ onUnlocked }: MasterKeyScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // Check if the vault has already been set up (salt exists in Supabase)
  React.useEffect(() => {
    async function checkVault() {
      try {
        const { data, error: fetchError } = await supabase
          .from('encrypted_records')
          .select('encrypted_data')
          .eq('id', SALT_RECORD_ID)
          .eq('collection_name', SYSTEM_COLLECTION)
          .maybeSingle();

        if (fetchError) {
          // Table might not exist yet — treat as first time
          console.warn('Could not check vault status:', fetchError.message);
          setIsFirstTime(true);
        } else {
          setIsFirstTime(!data);
        }
      } catch {
        setIsFirstTime(true);
      } finally {
        setChecking(false);
      }
    }
    checkVault();
  }, []);

  const handleSetup = useCallback(async () => {
    if (!password || password.length < 6) {
      setError('Master Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generate a random salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      // Derive the AES key
      const key = await deriveKeyFromPassword(password, salt);

      // Encrypt a known verification string so we can check the password later
      const verifyToken = await encryptData(VERIFY_PLAINTEXT, key);

      // Store salt + verification token in Supabase
      const { error: upsertError } = await supabase
        .from('encrypted_records')
        .upsert({
          id: SALT_RECORD_ID,
          collection_name: SYSTEM_COLLECTION,
          encrypted_data: JSON.stringify({ salt: saltBase64, verifyToken }),
          is_deleted: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      // Store the key in memory
      setMasterKey(key);
      const exported = await exportMasterKey(key);
      localStorage.setItem('crushtrack_vault_key', exported);
      onUnlocked();
    } catch (e: any) {
      setError(e.message || 'Failed to set up vault.');
    } finally {
      setLoading(false);
    }
  }, [password, confirmPassword, onUnlocked]);

  const handleUnlock = useCallback(async () => {
    if (!password) {
      setError('Please enter your Master Password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch the salt + verification token from Supabase
      const { data, error: fetchError } = await supabase
        .from('encrypted_records')
        .select('encrypted_data')
        .eq('id', SALT_RECORD_ID)
        .eq('collection_name', SYSTEM_COLLECTION)
        .single();

      if (fetchError || !data) throw new Error('Vault not found. Please contact your administrator.');

      const { salt: saltBase64, verifyToken } = JSON.parse(data.encrypted_data);

      // Reconstruct the salt
      const saltBinary = atob(saltBase64);
      const salt = new Uint8Array(saltBinary.length);
      for (let i = 0; i < saltBinary.length; i++) {
        salt[i] = saltBinary.charCodeAt(i);
      }

      // Derive the key from the entered password
      const key = await deriveKeyFromPassword(password, salt);

      // Try to decrypt the verification token
      const decrypted = await decryptData(verifyToken, key);

      if (decrypted !== VERIFY_PLAINTEXT) {
        throw new Error('Incorrect Master Password.');
      }

      // Success — store key in memory
      setMasterKey(key);
      const exported = await exportMasterKey(key);
      localStorage.setItem('crushtrack_vault_key', exported);
      onUnlocked();
    } catch (e: any) {
      if (e.message?.includes('Decryption failed')) {
        setError('Incorrect Master Password. Please try again.');
      } else {
        setError(e.message || 'Failed to unlock vault.');
      }
    } finally {
      setLoading(false);
    }
  }, [password, onUnlocked]);

  if (checking) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.checkingText}>Checking vault status...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.iconWrapper}>
          {isFirstTime ? (
            <ShieldCheck size={48} style={{ color: '#10b981' }} />
          ) : (
            <Lock size={48} style={{ color: '#6366f1' }} />
          )}
        </div>

        {/* Title */}
        <h1 style={styles.title}>
          {isFirstTime ? 'Set Up Vault' : 'Unlock Vault'}
        </h1>
        <p style={styles.subtitle}>
          {isFirstTime
            ? 'Create a Master Password to encrypt all your business data. This password cannot be recovered if lost.'
            : 'Enter your Master Password to access your encrypted data.'}
        </p>

        {/* Warning for first-time */}
        {isFirstTime && (
          <div style={styles.warning}>
            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>Write this password down and keep it safe. If you lose it, your data cannot be recovered.</span>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Password Input */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Master Password</label>
          <div style={styles.inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              style={styles.input}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isFirstTime) handleUnlock();
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password (first time only) */}
        {isFirstTime && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm Password</label>
            <div style={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm master password"
                style={styles.input}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetup();
                }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={isFirstTime ? handleSetup : handleUnlock}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            background: isFirstTime
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #6366f1, #4f46e5)',
          }}
        >
          {loading
            ? (isFirstTime ? 'Setting up...' : 'Unlocking...')
            : (isFirstTime ? 'Create Vault' : 'Unlock')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Styles (no dependency on index.css themes)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '1rem',
  },
  card: {
    background: 'rgba(30, 41, 59, 0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '1.5rem',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center' as const,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  },
  iconWrapper: {
    marginBottom: '1.25rem',
  },
  title: {
    color: '#f1f5f9',
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    margin: '0 0 1.5rem 0',
  },
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '0.75rem',
    marginBottom: '1.25rem',
    fontSize: '0.8rem',
    color: '#fbbf24',
    textAlign: 'left' as const,
    lineHeight: 1.4,
  },
  error: {
    padding: '0.625rem 1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
  inputGroup: {
    marginBottom: '1rem',
    textAlign: 'left' as const,
  },
  label: {
    display: 'block',
    color: '#cbd5e1',
    fontSize: '0.8rem',
    fontWeight: 500,
    marginBottom: '0.375rem',
  },
  inputWrapper: {
    position: 'relative' as const,
  },
  input: {
    width: '100%',
    padding: '0.75rem 2.5rem 0.75rem 1rem',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.75rem',
    color: '#f1f5f9',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  eyeButton: {
    position: 'absolute' as const,
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  button: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '0.75rem',
    border: 'none',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'opacity 0.2s',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 1rem auto',
  },
  checkingText: {
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
};

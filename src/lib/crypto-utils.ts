/**
 * crypto-utils.ts
 * Provides End-to-End Encryption (E2EE) using the native browser Web Crypto API (AES-GCM).
 */

// We use AES-GCM for authenticated encryption.
const ALGO_NAME = "AES-GCM";
const KEY_LENGTH_BITS = 256;
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE_BYTES = 16;
const IV_SIZE_BYTES = 12; // Standard for AES-GCM

/**
 * Derives a strong AES-GCM crypto key from a human-readable master password.
 * Uses PBKDF2 with SHA-256.
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: ALGO_NAME, length: KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportMasterKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(exported);
}

export async function importMasterKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: ALGO_NAME, length: KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plain JavaScript object into a base64 string containing both the IV and ciphertext.
 * Format: base64(IV + Ciphertext)
 */
export async function encryptData(data: any, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  // Generate a random Initialization Vector (IV) for this specific encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE_BYTES));

  // Encrypt
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: ALGO_NAME, iv: iv },
    key,
    encodedData
  );

  // Combine IV and Ciphertext so we can decrypt it later
  const combinedBuffer = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combinedBuffer.set(iv, 0);
  combinedBuffer.set(new Uint8Array(ciphertextBuffer), iv.length);

  // Convert to Base64 for safe storage in Supabase text columns
  return arrayBufferToBase64(combinedBuffer.buffer);
}

/**
 * Decrypts a base64 string back into a plain JavaScript object.
 */
export async function decryptData(encryptedBase64: string, key: CryptoKey): Promise<any> {
  try {
    const combinedBuffer = base64ToArrayBuffer(encryptedBase64);
    const combinedArray = new Uint8Array(combinedBuffer);

    // Extract the IV (first 12 bytes)
    const iv = combinedArray.slice(0, IV_SIZE_BYTES);
    
    // Extract the actual ciphertext
    const ciphertext = combinedArray.slice(IV_SIZE_BYTES);

    // Decrypt
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: ALGO_NAME, iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Decryption failed. Incorrect master password or corrupted data.", error);
    throw new Error("Decryption failed. Incorrect Master Password.");
  }
}

// --- Base64 Helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

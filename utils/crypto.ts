// This PEPPER should ideally be stored in a server environment variable, not in the client code.
// For this simulation, we define it here.
const PEPPER = "BJMP_DOCS_SECRET_PEPPER_KEY_2025"; 

/**
 * Generates a random salt
 */
export const generateSalt = (): string => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hashes a password using PBKDF2 with SHA-256
 */
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  const enc = new TextEncoder();
  
  // Combine Password + Salt + Pepper
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password + salt + PEPPER),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Export key to string for storage
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Verifies a password against a stored hash and salt
 */
export const verifyPassword = async (password: string, storedHash: string, salt: string): Promise<boolean> => {
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
};

import { randomBytes, createHash } from 'node:crypto';

/** Cryptographically-random opaque token (default 256 bits), URL-safe for email links. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 of a token, hex-encoded. We store only the hash for refresh and verification
 * tokens, so a DB leak never exposes a usable secret. SHA-256 (not argon2) is correct
 * here: the input is already high-entropy, and we need fast O(1) lookups by hash.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

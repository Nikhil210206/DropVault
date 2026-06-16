import argon2 from 'argon2';

// argon2id: memory-hard, resistant to GPU/ASIC attacks — current best practice.
const OPTIONS: argon2.Options = { type: argon2.argon2id };

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

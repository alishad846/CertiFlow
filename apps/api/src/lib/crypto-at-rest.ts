import crypto from 'node:crypto';
import { env } from '../config/env';

// AES-256-GCM encryption for secrets we must store but never keep in plaintext (DSC P12 bytes +
// passphrase). The key is derived from JWT_SECRET via scrypt so no extra secret is required; a DB
// leak alone never exposes the signing key. GCM's auth tag makes tampering detectable on decrypt.
const KEY = crypto.scryptSync(env.JWT_SECRET, 'certiflow-dsc', 32);

export type EncryptedSecret = { ciphertext: Buffer; iv: Buffer; tag: Buffer };

export function encryptSecret(plain: Buffer): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function decryptSecret({ ciphertext, iv, tag }: EncryptedSecret): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

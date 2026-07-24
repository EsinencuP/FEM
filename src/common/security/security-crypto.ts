import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ENCRYPTION_VERSION = 'v1';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function tokenMatchesHash(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptSecret(value: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('Encryption key must be exactly 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(value: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('Encryption key must be exactly 32 bytes');
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
  if (version !== ENCRYPTION_VERSION || !ivValue || !tagValue || ciphertextValue === undefined) {
    throw new Error('Encrypted secret has an unsupported format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

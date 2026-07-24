import { createHash } from 'node:crypto';

import { assertSafeTestDatabaseEnvironment } from '../../src/common/database/database-safety';

assertSafeTestDatabaseEnvironment(process.env);

if (!process.env.CORS_ALLOWED_ORIGINS?.trim()) {
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3001';
}

process.env.AUTH_ENCRYPTION_KEY ??= createHash('sha256')
  .update('fem-test-only-encryption-key')
  .digest('hex');

import { remoteDemoDatabaseConfirmation } from '../src/common/database/database-safety';

const databaseUrl = process.env.DATABASE_URL;

try {
  const confirmation = remoteDemoDatabaseConfirmation(databaseUrl);
  process.stdout.write(`${confirmation}\n`);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown confirmation error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

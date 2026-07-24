import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/bootstrap/configure-http-application';
import { createOpenApiDocument } from '../src/bootstrap/openapi';
import { AppConfigService } from '../src/config/app-config.service';

const CHECK_MODE = process.argv.includes('--check');

async function readSnapshot(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return undefined;
    }
    throw error;
  }
}

async function exportOpenApi(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });

  try {
    configureHttpApplication(app, moduleRef.get(AppConfigService));
    await app.init();
    const document = createOpenApiDocument(app);
    const outputDirectory = resolve(process.cwd(), 'api-client', 'openapi');
    const outputPath = resolve(outputDirectory, 'openapi.json');
    const checksumPath = resolve(outputDirectory, 'openapi.sha256');
    const snapshot = `${JSON.stringify(document, null, 2)}\n`;
    const checksum = `${createHash('sha256').update(snapshot).digest('hex')}  openapi.json\n`;

    if (CHECK_MODE) {
      const [committedSnapshot, committedChecksum] = await Promise.all([
        readSnapshot(outputPath),
        readSnapshot(checksumPath),
      ]);
      if (committedSnapshot !== snapshot || committedChecksum !== checksum) {
        throw new Error(
          'Committed OpenAPI snapshot is stale. Run "pnpm openapi:export" and commit openapi.json and openapi.sha256.',
        );
      }
      process.stdout.write(`OpenAPI snapshot and checksum are current at ${outputPath}\n`);
      return;
    }

    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(outputPath, snapshot, 'utf8'),
      writeFile(checksumPath, checksum, 'utf8'),
    ]);
    process.stdout.write(`OpenAPI snapshot and checksum written to ${outputDirectory}\n`);
  } finally {
    await app.close();
  }
}

void exportOpenApi().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : 'Unknown OpenAPI export error';
  process.stderr.write(`OpenAPI export failed: ${message}\n`);
  process.exitCode = 1;
});

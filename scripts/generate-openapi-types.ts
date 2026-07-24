import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

const CHECK_MODE = process.argv.includes('--check');
const inputPath = resolve(process.cwd(), 'api-client', 'openapi', 'openapi.json');
const outputPath = resolve(process.cwd(), 'api-client', 'generated', 'schema.d.ts');

async function readExistingOutput(): Promise<string | undefined> {
  try {
    return await readFile(outputPath, 'utf8');
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

async function generateOpenApiTypes(): Promise<void> {
  const ast = await openapiTS(await readFile(inputPath), {
    alphabetize: true,
    immutable: true,
    pathParamsAsTypes: true,
  });
  const generated = `${COMMENT_HEADER}${astToString(ast)}`;

  if (CHECK_MODE) {
    if ((await readExistingOutput()) !== generated) {
      throw new Error(
        'Generated OpenAPI types are stale. Run "pnpm openapi:types" and commit api-client/generated/schema.d.ts.',
      );
    }
    process.stdout.write(`Generated OpenAPI types are current at ${outputPath}\n`);
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, 'utf8');
  process.stdout.write(`Generated OpenAPI types written to ${outputPath}\n`);
}

void generateOpenApiTypes().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? (error.stack ?? error.message)
      : 'Unknown OpenAPI type generation error';
  process.stderr.write(`OpenAPI type generation failed: ${message}\n`);
  process.exitCode = 1;
});

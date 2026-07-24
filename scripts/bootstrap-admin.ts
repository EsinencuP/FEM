import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

import { encryptSecret, hashToken, randomToken } from '../src/common/security/security-crypto';

const prisma = new PrismaClient();

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function bootstrapAdmin(): Promise<void> {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
    throw new Error('Set ALLOW_ADMIN_BOOTSTRAP=true only for an intentional one-time bootstrap');
  }
  const email = requiredEnvironment('INITIAL_ADMIN_EMAIL').toLowerCase();
  const displayName = requiredEnvironment('INITIAL_ADMIN_DISPLAY_NAME');
  const password = requiredEnvironment('INITIAL_ADMIN_PASSWORD');
  const totpSecret = requiredEnvironment('INITIAL_ADMIN_TOTP_SECRET').replace(/\s+/g, '');
  const encryptionKeyValue = requiredEnvironment('AUTH_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(encryptionKeyValue)) {
    throw new Error('AUTH_ENCRYPTION_KEY must be 64 hexadecimal characters');
  }
  if (password.length < 12 || password.length > 200) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain 12 to 200 characters');
  }
  if (!/^[A-Z2-7]+=*$/i.test(totpSecret)) {
    throw new Error('INITIAL_ADMIN_TOTP_SECRET must be a Base32 authenticator secret');
  }
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { credential: true },
  });
  if (existing?.credential) {
    throw new Error('Administrator credential already exists; bootstrap will not overwrite it');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const recoveryCodes = Array.from({ length: 10 }, () => randomToken(12).toUpperCase());
  const encryptionKey = Buffer.from(encryptionKeyValue, 'hex');

  const userId = await prisma.$transaction(async (transaction) => {
    const role = await transaction.role.upsert({
      where: { code: 'ADMIN' },
      update: { name: 'Administrator', isSystem: true, archivedAt: null },
      create: {
        code: 'ADMIN',
        name: 'Administrator',
        description: 'Human administrator role required by the release acceptance criteria',
        isSystem: true,
      },
    });
    const user = existing
      ? await transaction.user.update({
          where: { id: existing.id },
          data: { displayName, status: 'ACTIVE', archivedAt: null },
        })
      : await transaction.user.create({
          data: { email, displayName, status: 'ACTIVE' },
        });
    await transaction.userCredential.create({
      data: {
        userId: user.id,
        passwordHash,
        totpSecretEncrypted: encryptSecret(totpSecret, encryptionKey),
        twoFactorEnabledAt: new Date(),
      },
    });
    const existingRole = await transaction.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, archivedAt: null, endDate: null },
    });
    if (!existingRole) {
      await transaction.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          startDate: new Date(),
        },
      });
    }
    await transaction.adminRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: hashToken(code) })),
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.id,
        action: 'ADMIN_BOOTSTRAPPED',
        entityType: 'User',
        entityId: user.id,
      },
    });
    return user.id;
  });

  process.stdout.write(`Administrator ${userId} created.\n`);
  process.stdout.write('Store these one-time recovery codes securely; they will not be shown again:\n');
  process.stdout.write(`${recoveryCodes.join('\n')}\n`);
}

void bootstrapAdmin()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
    process.stderr.write(`Administrator bootstrap failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

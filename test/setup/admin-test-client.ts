import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import request, { type Test } from 'supertest';

import { encryptSecret } from '../../src/common/security/security-crypto';
import { AppConfigService } from '../../src/config/app-config.service';
import { PrismaService } from '../../src/database/prisma.service';

export const TEST_ADMIN_EMAIL = 'integration-admin@example.invalid';
export const TEST_ADMIN_PASSWORD = 'Integration-Only-Password-2026!';
const ADMIN_PERMISSIONS = [
  ['ADMIN_READ', 'Read administrative data'],
  ['ADMIN_WRITE', 'Change administrative data'],
  ['AUDIT_READ', 'Read audit log'],
  ['SECURITY_SELF', 'Manage own security'],
] as const;

export interface ProvisionedAdmin {
  userId: string;
  email: string;
  password: string;
  secret: string;
}

export class AdminTestClient {
  constructor(
    private readonly agent: ReturnType<typeof request.agent>,
    private readonly csrfToken: string,
  ) {}

  get(path: string): Test {
    return this.agent.get(path);
  }

  post(path: string): Test {
    return this.agent
      .post(path)
      .set('X-CSRF-Token', this.csrfToken)
      .set('Idempotency-Key', randomUUID());
  }

  patch(path: string): Test {
    return this.agent
      .patch(path)
      .set('X-CSRF-Token', this.csrfToken)
      .set('If-Match', '*')
      .set('X-Confirm-Action', 'true')
      .set('X-Action-Reason', 'Integration test controlled version override');
  }

  patchWithVersion(path: string, version: number): Test {
    return this.agent
      .patch(path)
      .set('X-CSRF-Token', this.csrfToken)
      .set('If-Match', String(version));
  }

  delete(path: string): Test {
    return this.agent
      .delete(path)
      .set('X-CSRF-Token', this.csrfToken)
      .set('X-Confirm-Action', 'true')
      .set('X-Action-Reason', 'Integration test deletion');
  }

  options(path: string): Test {
    return this.agent.options(path);
  }
}

export async function provisionAdminTestIdentity(
  app: NestExpressApplication,
): Promise<ProvisionedAdmin> {
  const prisma = app.get(PrismaService);
  const config = app.get(AppConfigService);
  const secret = authenticator.generateSecret();
  const passwordHash = await argon2.hash(TEST_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const role = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { archivedAt: null, name: 'Administrator', isSystem: true },
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'Human administrator role required by the release acceptance criteria',
      isSystem: true,
      isDemo: true,
    },
  });
  for (const [code, name] of ADMIN_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { name, isSystem: true, archivedAt: null },
      create: { code, name, isSystem: true },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
  const user = await prisma.user.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: {
      displayName: 'Integration Test Administrator',
      status: 'ACTIVE',
      archivedAt: null,
    },
    create: {
      email: TEST_ADMIN_EMAIL,
      displayName: 'Integration Test Administrator',
      status: 'ACTIVE',
      isDemo: true,
    },
  });
  await prisma.rateLimitBucket.deleteMany();
  await prisma.$transaction([
    prisma.adminSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'TEST_IDENTITY_RESET' },
    }),
    prisma.adminRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        passwordHash,
        totpSecretEncrypted: encryptSecret(secret, config.authEncryptionKey),
        twoFactorEnabledAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastTotpStep: null,
      },
      create: {
        userId: user.id,
        passwordHash,
        totpSecretEncrypted: encryptSecret(secret, config.authEncryptionKey),
        twoFactorEnabledAt: new Date(),
      },
    }),
  ]);
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, archivedAt: null, endDate: null },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        isDemo: true,
      },
    });
  }

  return {
    userId: user.id,
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    secret,
  };
}

export async function createAdminTestClient(
  app: NestExpressApplication,
): Promise<AdminTestClient> {
  const identity = await provisionAdminTestIdentity(app);
  const agent = request.agent(app.getHttpServer());
  const otp = authenticator.generate(identity.secret);
  const login = await agent
    .post('/api/v1/auth/login')
    .send({ email: identity.email, password: identity.password, otp })
    .expect(200);
  const body = login.body as unknown;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    typeof body.data !== 'object' ||
    body.data === null ||
    !('csrfToken' in body.data) ||
    typeof body.data.csrfToken !== 'string'
  ) {
    throw new Error('Authentication response did not contain a CSRF token');
  }
  return new AdminTestClient(agent, body.data.csrfToken);
}

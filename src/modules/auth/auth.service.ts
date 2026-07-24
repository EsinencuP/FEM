import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

import { withSerializableTransaction } from '../../common/database/serializable-transaction';
import { RequestAuditContext } from '../../common/context/request-audit-context';
import { dataResponse, type DataResponse } from '../../common/dto/api-response';
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  randomToken,
  tokenMatchesHash,
} from '../../common/security/security-crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import type {
  ChangePasswordDto,
  ConfirmTotpReenrollmentDto,
  LoginDto,
  RotateRecoveryCodesDto,
  StartTotpReenrollmentDto,
} from './dto/auth.dto';
import type { AuthenticatedAdmin, RequestSecurityMetadata } from './auth.types';

const ADMIN_ROLE = 'ADMIN';
const SESSION_TOUCH_INTERVAL_MS = 60_000;
const RECOVERY_CODE_COUNT = 10;
const TOTP_STEP_MS = 30_000;
const TOTP_REENROLLMENT_TTL_MS = 10 * 60_000;
const SESSION_ROTATION_GRACE_MS = 5_000;

interface LoginResult {
  cookieToken: string;
  response: DataResponse<{
    user: {
      id: string;
      email: string;
      displayName: string;
      roles: string[];
      permissions: string[];
    };
    session: { id: string; expiresAt: Date; idleExpiresAt: Date };
    csrfToken: string;
  }>;
}

type SessionRotationResult = LoginResult;

@Injectable()
export class AuthService {
  private invalidPasswordHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async login(dto: LoginDto, metadata: RequestSecurityMetadata): Promise<LoginResult> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        credential: true,
        userRoles: {
          where: {
            archivedAt: null,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            role: { code: ADMIN_ROLE, archivedAt: null },
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  where: { permission: { archivedAt: null } },
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.credential) {
      await this.consumeInvalidPassword(dto.password);
      throw this.invalidCredentials();
    }
    if (
      user.archivedAt ||
      user.status !== 'ACTIVE' ||
      user.userRoles.length === 0 ||
      (user.credential.lockedUntil && user.credential.lockedUntil > now)
    ) {
      throw this.invalidCredentials();
    }

    const passwordValid = await argon2.verify(user.credential.passwordHash, dto.password);
    if (!passwordValid) {
      await this.recordFailedLogin(user.id, metadata);
      throw this.invalidCredentials();
    }

    const totpSecret = decryptSecret(
      user.credential.totpSecretEncrypted,
      this.config.authEncryptionKey,
    );
    const recoveryCodeHash = dto.recoveryCode
      ? hashToken(dto.recoveryCode.trim().toUpperCase())
      : undefined;
    const totpStep = dto.otp ? BigInt(Math.floor(now.getTime() / TOTP_STEP_MS)) : undefined;
    const secondFactorValid = dto.otp
      ? authenticator.verify({ secret: totpSecret, token: dto.otp })
      : recoveryCodeHash !== undefined;
    if (!secondFactorValid) {
      await this.recordFailedLogin(user.id, metadata);
      throw this.invalidCredentials();
    }

    const cookieToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(now.getTime() + this.config.authSessionTtlMinutes * 60_000);
    const idleExpiresAt = new Date(
      Math.min(expiresAt.getTime(), now.getTime() + this.config.authSessionIdleMinutes * 60_000),
    );
    const roles = user.userRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.rolePermissions.map(({ permission }) => permission.code),
        ),
      ),
    ];

    const session = await withSerializableTransaction(this.prisma, async (transaction) => {
      if (totpStep !== undefined) {
        const consumed = await transaction.userCredential.updateMany({
          where: {
            userId: user.id,
            OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: totpStep } }],
          },
          data: { lastTotpStep: totpStep },
        });
        if (consumed.count !== 1) return null;
      }
      if (recoveryCodeHash) {
        const consumed = await transaction.adminRecoveryCode.updateMany({
          where: { userId: user.id, codeHash: recoveryCodeHash, usedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) return null;
      }
      await transaction.userCredential.update({
        where: { userId: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      const created = await transaction.adminSession.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(cookieToken),
          csrfTokenHash: hashToken(csrfToken),
          secondFactorMethod: recoveryCodeHash ? 'RECOVERY' : 'TOTP',
          expiresAt,
          idleExpiresAt,
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 64) } : {}),
          ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
        },
      });
      await this.writeAudit(transaction, {
        actorId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'AdminSession',
        entityId: created.id,
        sessionId: created.id,
        requestId: metadata.requestId,
        newData: { sessionId: created.id },
      });
      return created;
    });
    if (!session) {
      await this.recordFailedLogin(user.id, metadata);
      throw this.invalidCredentials();
    }

    return {
      cookieToken,
      response: dataResponse({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roles,
          permissions,
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          idleExpiresAt: session.idleExpiresAt,
        },
        csrfToken,
      }),
    };
  }

  async authenticate(
    cookieToken: string | undefined,
    metadata: RequestSecurityMetadata = {},
  ): Promise<AuthenticatedAdmin> {
    if (!cookieToken) throw new UnauthorizedException(this.unauthorizedBody());
    const now = new Date();
    const suppliedTokenHash = hashToken(cookieToken);
    const session = await this.prisma.adminSession.findFirst({
      where: {
        OR: [{ tokenHash: suppliedTokenHash }, { previousTokenHash: suppliedTokenHash }],
      },
      include: {
        user: {
          include: {
            userRoles: {
              where: {
                archivedAt: null,
                startDate: { lte: now },
                OR: [{ endDate: null }, { endDate: { gte: now } }],
                role: { archivedAt: null },
              },
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      where: { permission: { archivedAt: null } },
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now ||
      session.user.archivedAt ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(this.unauthorizedBody());
    }
    if (session.previousTokenHash === suppliedTokenHash) {
      if (session.previousTokenExpiresAt && session.previousTokenExpiresAt > now) {
        throw new UnauthorizedException(this.unauthorizedBody());
      }
      await withSerializableTransaction(this.prisma, async (transaction) => {
        await transaction.adminSession.update({
          where: { id: session.id },
          data: { revokedAt: now, revokeReason: 'TOKEN_REUSE_DETECTED' },
        });
        await this.writeAudit(transaction, {
          actorId: session.userId,
          action: 'AUTH_SESSION_TOKEN_REUSE',
          entityType: 'AdminSession',
          entityId: session.id,
          sessionId: session.id,
          requestId: metadata.requestId,
        });
      });
      throw new UnauthorizedException(this.unauthorizedBody());
    }
    const roles = session.user.userRoles.map(({ role }) => role.code);
    if (!roles.includes(ADMIN_ROLE)) {
      throw new ForbiddenException({
        message: 'Administrator permission is required',
        code: 'FORBIDDEN',
      });
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      const idleExpiresAt = new Date(
        Math.min(
          session.expiresAt.getTime(),
          now.getTime() + this.config.authSessionIdleMinutes * 60_000,
        ),
      );
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now, idleExpiresAt },
      });
    }
    return {
      userId: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      displayName: session.user.displayName,
      roles,
      permissions: [
        ...new Set(
          session.user.userRoles.flatMap(({ role }) =>
            role.rolePermissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
      csrfTokenHash: session.csrfTokenHash,
      sessionTokenHash: session.tokenHash,
      secondFactorMethod:
        session.secondFactorMethod === 'RECOVERY' ? 'RECOVERY' : 'TOTP',
    };
  }

  assertCsrf(admin: AuthenticatedAdmin, csrfToken: string | undefined): void {
    if (!csrfToken || !tokenMatchesHash(csrfToken, admin.csrfTokenHash)) {
      throw new ForbiddenException({
        message: 'A valid CSRF token is required',
        code: 'CSRF_VALIDATION_FAILED',
      });
    }
  }

  me(admin: AuthenticatedAdmin): DataResponse<{
    userId: string;
    sessionId: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
    secondFactorMethod: 'TOTP' | 'RECOVERY';
  }> {
    return dataResponse({
      userId: admin.userId,
      sessionId: admin.sessionId,
      email: admin.email,
      displayName: admin.displayName,
      roles: admin.roles,
      permissions: admin.permissions,
      secondFactorMethod: admin.secondFactorMethod,
    });
  }

  async refreshSession(
    admin: AuthenticatedAdmin,
    metadata: RequestSecurityMetadata,
  ): Promise<SessionRotationResult> {
    const now = new Date();
    const cookieToken = randomToken();
    const csrfToken = randomToken();
    const session = await withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.adminSession.findUniqueOrThrow({
        where: { id: admin.sessionId },
      });
      const idleExpiresAt = new Date(
        Math.min(
          current.expiresAt.getTime(),
          now.getTime() + this.config.authSessionIdleMinutes * 60_000,
        ),
      );
      const rotated = await transaction.adminSession.updateMany({
        where: {
          id: admin.sessionId,
          tokenHash: admin.sessionTokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
          idleExpiresAt: { gt: now },
        },
        data: {
          previousTokenHash: admin.sessionTokenHash,
          previousTokenExpiresAt: new Date(now.getTime() + SESSION_ROTATION_GRACE_MS),
          tokenHash: hashToken(cookieToken),
          csrfTokenHash: hashToken(csrfToken),
          tokenRotatedAt: now,
          lastSeenAt: now,
          idleExpiresAt,
        },
      });
      if (rotated.count !== 1) throw new UnauthorizedException(this.unauthorizedBody());
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_SESSION_REFRESHED',
        entityType: 'AdminSession',
        entityId: admin.sessionId,
        requestId: metadata.requestId,
      });
      return transaction.adminSession.findUniqueOrThrow({ where: { id: admin.sessionId } });
    });

    return {
      cookieToken,
      response: dataResponse({
        user: {
          id: admin.userId,
          email: admin.email,
          displayName: admin.displayName,
          roles: admin.roles,
          permissions: admin.permissions,
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          idleExpiresAt: session.idleExpiresAt,
        },
        csrfToken,
      }),
    };
  }

  async startTotpReenrollment(
    admin: AuthenticatedAdmin,
    dto: StartTotpReenrollmentDto,
    metadata: RequestSecurityMetadata,
  ): Promise<DataResponse<{ secret: string; expiresAt: Date }>> {
    if (admin.secondFactorMethod !== 'RECOVERY') {
      throw new ForbiddenException({
        message: 'TOTP re-enrollment requires a recovery-code session',
        code: 'RECOVERY_SESSION_REQUIRED',
      });
    }
    const credential = await this.prisma.userCredential.findUniqueOrThrow({
      where: { userId: admin.userId },
    });
    if (!(await argon2.verify(credential.passwordHash, dto.currentPassword))) {
      throw this.invalidCredentials();
    }
    const secret = authenticator.generateSecret();
    const expiresAt = new Date(Date.now() + TOTP_REENROLLMENT_TTL_MS);
    await withSerializableTransaction(this.prisma, async (transaction) => {
      await transaction.adminSession.update({
        where: { id: admin.sessionId },
        data: {
          pendingTotpSecretEncrypted: encryptSecret(secret, this.config.authEncryptionKey),
          pendingTotpExpiresAt: expiresAt,
        },
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_TOTP_REENROLLMENT_STARTED',
        entityType: 'AdminSession',
        entityId: admin.sessionId,
        requestId: metadata.requestId,
      });
    });
    return dataResponse({ secret, expiresAt });
  }

  async confirmTotpReenrollment(
    admin: AuthenticatedAdmin,
    dto: ConfirmTotpReenrollmentDto,
    metadata: RequestSecurityMetadata,
  ): Promise<DataResponse<{ recoveryCodes: string[] }>> {
    if (admin.secondFactorMethod !== 'RECOVERY') {
      throw new ForbiddenException({
        message: 'TOTP re-enrollment requires a recovery-code session',
        code: 'RECOVERY_SESSION_REQUIRED',
      });
    }
    const session = await this.prisma.adminSession.findUniqueOrThrow({
      where: { id: admin.sessionId },
      select: { pendingTotpSecretEncrypted: true, pendingTotpExpiresAt: true },
    });
    const now = new Date();
    if (
      !session.pendingTotpSecretEncrypted ||
      !session.pendingTotpExpiresAt ||
      session.pendingTotpExpiresAt <= now
    ) {
      throw new ForbiddenException({
        message: 'TOTP re-enrollment challenge is missing or expired',
        code: 'TOTP_REENROLLMENT_EXPIRED',
      });
    }
    const secret = decryptSecret(
      session.pendingTotpSecretEncrypted,
      this.config.authEncryptionKey,
    );
    if (!authenticator.verify({ secret, token: dto.otp })) throw this.invalidCredentials();
    const totpStep = BigInt(Math.floor(now.getTime() / TOTP_STEP_MS));
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomToken(12).toUpperCase(),
    );
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const consumed = await transaction.adminSession.updateMany({
        where: {
          id: admin.sessionId,
          secondFactorMethod: 'RECOVERY',
          pendingTotpSecretEncrypted: session.pendingTotpSecretEncrypted,
          pendingTotpExpiresAt: { gt: now },
        },
        data: {
          secondFactorMethod: 'TOTP',
          pendingTotpSecretEncrypted: null,
          pendingTotpExpiresAt: null,
        },
      });
      if (consumed.count !== 1) {
        throw new ConflictException({
          message: 'TOTP re-enrollment challenge was already used',
          code: 'TOTP_REENROLLMENT_ALREADY_USED',
        });
      }
      await transaction.userCredential.update({
        where: { userId: admin.userId },
        data: {
          totpSecretEncrypted: encryptSecret(secret, this.config.authEncryptionKey),
          twoFactorEnabledAt: now,
          lastTotpStep: totpStep,
        },
      });
      await transaction.adminRecoveryCode.deleteMany({ where: { userId: admin.userId } });
      await transaction.adminRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          userId: admin.userId,
          codeHash: hashToken(code),
        })),
      });
      await transaction.adminSession.updateMany({
        where: { userId: admin.userId, id: { not: admin.sessionId }, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'TOTP_REENROLLED' },
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_TOTP_REENROLLED',
        entityType: 'User',
        entityId: admin.userId,
        requestId: metadata.requestId,
      });
    });
    return dataResponse({ recoveryCodes });
  }

  async listSessions(admin: AuthenticatedAdmin): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.adminSession.findMany({
        where: { userId: admin.userId },
        select: {
          id: true,
          expiresAt: true,
          idleExpiresAt: true,
          lastSeenAt: true,
          revokedAt: true,
          revokeReason: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
  }

  async logout(
    admin: AuthenticatedAdmin,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await withSerializableTransaction(this.prisma, async (transaction) => {
      await transaction.adminSession.update({
        where: { id: admin.sessionId },
        data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_LOGOUT',
        entityType: 'AdminSession',
        entityId: admin.sessionId,
        requestId: metadata.requestId,
      });
    });
  }

  async revokeSession(
    admin: AuthenticatedAdmin,
    sessionId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const session = await transaction.adminSession.findFirst({
        where: { id: sessionId, userId: admin.userId },
      });
      if (!session) {
        throw new NotFoundException({ message: 'Session not found', code: 'NOT_FOUND' });
      }
      await transaction.adminSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokeReason: 'USER_REVOKED' },
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_SESSION_REVOKE',
        entityType: 'AdminSession',
        entityId: session.id,
        requestId: metadata.requestId,
      });
    });
  }

  async changePassword(
    admin: AuthenticatedAdmin,
    dto: ChangePasswordDto,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    const passwordHash = await this.hashPassword(dto.newPassword);
    await withSerializableTransaction(this.prisma, async (transaction) => {
      await this.claimTotpStep(
        transaction,
        admin.userId,
        dto.otp,
        dto.currentPassword,
      );
      await transaction.userCredential.update({
        where: { userId: admin.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await transaction.adminSession.updateMany({
        where: { userId: admin.userId, id: { not: admin.sessionId }, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_PASSWORD_CHANGED',
        entityType: 'User',
        entityId: admin.userId,
        requestId: metadata.requestId,
      });
    });
  }

  async rotateRecoveryCodes(
    admin: AuthenticatedAdmin,
    dto: RotateRecoveryCodesDto,
    metadata: RequestSecurityMetadata,
  ): Promise<DataResponse<{ recoveryCodes: string[] }>> {
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomToken(12).toUpperCase(),
    );
    await withSerializableTransaction(this.prisma, async (transaction) => {
      await this.claimTotpStep(transaction, admin.userId, dto.otp);
      await transaction.adminRecoveryCode.deleteMany({ where: { userId: admin.userId } });
      await transaction.adminRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          userId: admin.userId,
          codeHash: hashToken(code),
        })),
      });
      await this.writeAudit(transaction, {
        actorId: admin.userId,
        action: 'AUTH_RECOVERY_CODES_ROTATED',
        entityType: 'User',
        entityId: admin.userId,
        requestId: metadata.requestId,
      });
    });
    return dataResponse({ recoveryCodes });
  }

  private async claimTotpStep(
    transaction: Prisma.TransactionClient,
    userId: string,
    otp: string,
    currentPassword?: string,
  ): Promise<void> {
    const credential = await transaction.userCredential.findUniqueOrThrow({
      where: { userId },
      select: {
        passwordHash: true,
        totpSecretEncrypted: true,
      },
    });
    const [passwordValid, otpValid] = await Promise.all([
      currentPassword === undefined
        ? Promise.resolve(true)
        : argon2.verify(credential.passwordHash, currentPassword),
      Promise.resolve(
        authenticator.verify({
          secret: decryptSecret(
            credential.totpSecretEncrypted,
            this.config.authEncryptionKey,
          ),
          token: otp,
        }),
      ),
    ]);
    if (!passwordValid || !otpValid) throw this.invalidCredentials();
    const totpStep = BigInt(Math.floor(Date.now() / TOTP_STEP_MS));
    const consumed = await transaction.userCredential.updateMany({
      where: {
        userId,
        OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: totpStep } }],
      },
      data: { lastTotpStep: totpStep },
    });
    if (consumed.count !== 1) throw this.invalidCredentials();
  }

  private async recordFailedLogin(
    userId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await withSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const credential = await transaction.userCredential.findUniqueOrThrow({
          where: { userId },
          select: { failedLoginAttempts: true, lockedUntil: true },
        });
        const now = new Date();
        if (credential.lockedUntil && credential.lockedUntil > now) {
          await this.writeAudit(transaction, {
            action: 'AUTH_LOGIN_FAILED',
            entityType: 'User',
            entityId: userId,
            requestId: metadata.requestId,
          });
          return;
        }
        const nextAttempts = credential.failedLoginAttempts + 1;
        const lockedUntil =
          nextAttempts >= this.config.authMaxFailedAttempts
            ? new Date(now.getTime() + this.config.authLockoutMinutes * 60_000)
            : null;
        await transaction.userCredential.update({
          where: { userId },
          data: lockedUntil
            ? { failedLoginAttempts: 0, lockedUntil }
            : { failedLoginAttempts: nextAttempts },
        });
        await this.writeAudit(transaction, {
          action: lockedUntil ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
          entityType: 'User',
          entityId: userId,
          requestId: metadata.requestId,
        });
      },
      this.config.authMaxFailedAttempts * 2,
    );
  }

  private async consumeInvalidPassword(password: string): Promise<void> {
    this.invalidPasswordHash ??= this.hashPassword('__invalid_account_password__');
    const hash = await this.invalidPasswordHash;
    await argon2.verify(hash, password);
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      message: 'Invalid credentials or second factor',
      code: 'AUTHENTICATION_FAILED',
    });
  }

  private unauthorizedBody(): { message: string; code: string } {
    return { message: 'A valid administrator session is required', code: 'UNAUTHORIZED' };
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    event: {
      actorId?: string | undefined;
      action: string;
      entityType: string;
      entityId: string;
      sessionId?: string | undefined;
      requestId?: string | undefined;
      newData?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    const sessionId = event.sessionId ?? RequestAuditContext.current()?.sessionId;
    return transaction.auditLog.create({
      data: {
        ...(event.actorId ? { actorId: event.actorId } : {}),
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        ...(sessionId ? { sessionId } : {}),
        ...(event.requestId ? { requestId: event.requestId } : {}),
        ...(event.newData ? { newData: event.newData } : {}),
      },
    });
  }
}

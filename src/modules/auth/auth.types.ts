import type { Request } from 'express';

export interface AuthenticatedAdmin {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
  roles: string[];
  csrfTokenHash: string;
  sessionTokenHash: string;
  secondFactorMethod: 'TOTP' | 'RECOVERY';
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export interface RequestSecurityMetadata {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

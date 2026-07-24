import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';

export function RequirePermissions(...permissions: string[]): ClassDecorator & MethodDecorator {
  return SetMetadata(REQUIRED_PERMISSIONS, permissions);
}

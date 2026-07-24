import { BadRequestException } from '@nestjs/common';

export function assertActiveRecord(
  record: { archivedAt: Date | null },
  resourceName: string,
): void {
  if (record.archivedAt) {
    throw new BadRequestException({
      message: `Restore the archived ${resourceName} before updating it`,
      code: 'ARCHIVED_RESOURCE',
    });
  }
}

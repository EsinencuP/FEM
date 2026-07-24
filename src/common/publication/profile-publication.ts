import { ConflictException } from '@nestjs/common';
import type { PublicationStatus, RecordStatus } from '@prisma/client';

interface ProfilePublicationRecord {
  isDemo: boolean;
  publicationStatus: PublicationStatus;
  publishedAt: Date | null;
  status?: RecordStatus;
}

const PUBLIC_RECORD_STATUSES = new Set<RecordStatus>(['ACTIVE', 'INACTIVE']);

export function assertProfileMutable(
  record: Pick<ProfilePublicationRecord, 'publicationStatus'>,
  resourceName: string,
): void {
  if (record.publicationStatus === 'PUBLISHED') {
    throw new ConflictException({
      message: `Withdraw the published ${resourceName} before changing it`,
      code: 'PUBLISHED_RESOURCE_IMMUTABLE',
    });
  }
}

export function assertProfilePublishable(
  record: ProfilePublicationRecord,
  resourceName: string,
): void {
  if (record.isDemo) {
    throw new ConflictException({
      message: `Demo ${resourceName} records cannot be published`,
      code: 'DEMO_PUBLICATION_FORBIDDEN',
    });
  }
  if (record.publicationStatus === 'PUBLISHED') {
    throw new ConflictException({
      message: `${resourceName} is already published`,
      code: 'ALREADY_PUBLISHED',
    });
  }
  if (record.status !== undefined && !PUBLIC_RECORD_STATUSES.has(record.status)) {
    throw new ConflictException({
      message: `${resourceName} must be active or inactive before publication`,
      code: 'PUBLICATION_STATE_INVALID',
    });
  }
}

export function assertProfileWithdrawable(
  record: Pick<ProfilePublicationRecord, 'publicationStatus'>,
  resourceName: string,
): void {
  if (record.publicationStatus !== 'PUBLISHED') {
    throw new ConflictException({
      message: `Only a published ${resourceName} can be withdrawn`,
      code: 'PUBLICATION_STATE_INVALID',
    });
  }
}

export function profilePublishData(
  record: Pick<ProfilePublicationRecord, 'publishedAt'>,
): { publicationStatus: 'PUBLISHED'; publishedAt: Date } {
  return {
    publicationStatus: 'PUBLISHED',
    publishedAt: record.publishedAt ?? new Date(),
  };
}

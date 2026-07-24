import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { assertActiveRecord } from './archive-policy';

interface NamedReferenceState {
  resourceName: string;
  state: { archivedAt: Date | null; isDemo: boolean } | null;
}

export function validateReferenceStates(
  references: NamedReferenceState[],
  expectedIsDemo?: boolean,
): boolean {
  for (const reference of references) {
    if (!reference.state) {
      throw new NotFoundException({
        message: `${reference.resourceName} not found`,
        code: 'NOT_FOUND',
      });
    }
    assertActiveRecord(reference.state, reference.resourceName.toLowerCase());
  }

  const resolvedIsDemo = expectedIsDemo ?? references[0]?.state?.isDemo ?? false;
  if (references.some((reference) => reference.state?.isDemo !== resolvedIsDemo)) {
    throw new BadRequestException({
      message: 'Related resources must share the same demo boundary',
      code: 'DEMO_BOUNDARY_CONFLICT',
    });
  }
  return resolvedIsDemo;
}

export async function assertSourceDocumentReference(
  transaction: Prisma.TransactionClient,
  sourceDocumentId: string | null | undefined,
  expectedIsDemo: boolean,
): Promise<void> {
  if (!sourceDocumentId) return;

  const document = await transaction.document.findUnique({
    where: { id: sourceDocumentId },
    select: { archivedAt: true, isDemo: true },
  });
  if (!document) {
    throw new NotFoundException({ message: 'Source document not found', code: 'NOT_FOUND' });
  }
  assertActiveRecord(document, 'source document');
  if (document.isDemo !== expectedIsDemo) {
    throw new BadRequestException({
      message: 'Source document must share the same demo boundary',
      code: 'DEMO_BOUNDARY_CONFLICT',
    });
  }
}

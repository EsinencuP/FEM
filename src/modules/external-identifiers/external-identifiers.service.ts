import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VerificationStatus, type ExternalIdentifier, type Prisma } from '@prisma/client';
import { assertSourceDocumentReference } from '../../common/database/reference-policy';
import { withSerializableTransaction } from '../../common/database/serializable-transaction';
import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { paginationArgs, type PaginationQuery } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateExternalIdentifierDto,
  UpdateExternalIdentifierDto,
} from './dto/external-identifier.dto';

export type IdentifierEntityType = 'Athlete' | 'Horse' | 'Club' | 'CompetitionEvent';
const NORMALIZATION_VERSION = 'nfkc-trim-v1';

@Injectable()
export class ExternalIdentifiersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    entityType: IdentifierEntityType,
    entityId: string,
    query: PaginationQuery,
  ): Promise<ListResponse<unknown>> {
    await this.assertEntity(entityType, entityId);
    const where = { entityType, entityId, archivedAt: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalIdentifier.findMany({
        where: { entityType, entityId, archivedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
        select: {
          id: true,
          identifierType: true,
          namespace: true,
          value: true,
          normalizationVersion: true,
          verificationStatus: true,
          isPrimary: true,
          validFrom: true,
          validTo: true,
          sourceReference: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.externalIdentifier.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async create(
    entityType: IdentifierEntityType,
    entityId: string,
    dto: CreateExternalIdentifierDto,
  ): Promise<DataResponse<ExternalIdentifier>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const target = await this.getEntityState(transaction, entityType, entityId);
      this.assertActive(target.archivedAt, entityType);
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, target.isDemo);
      const normalizedValue = this.normalize(dto.value);
      const data: Prisma.ExternalIdentifierUncheckedCreateInput = {
        entityType,
        entityId,
        identifierType: dto.identifierType,
        namespace: dto.namespace,
        value: dto.value,
        normalizedValue,
        normalizationVersion: NORMALIZATION_VERSION,
        verificationStatus: VerificationStatus.UNVERIFIED,
        isPrimary: false,
        isDemo: target.isDemo,
        ...(dto.validFrom !== undefined ? { validFrom: dto.validFrom } : {}),
        ...(dto.validTo !== undefined ? { validTo: dto.validTo } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
        ...(dto.sourceReference !== undefined ? { sourceReference: dto.sourceReference } : {}),
      };
      return dataResponse(await transaction.externalIdentifier.create({ data }));
    });
  }

  async update(
    entityType: IdentifierEntityType,
    entityId: string,
    identifierId: string,
    dto: UpdateExternalIdentifierDto,
  ): Promise<DataResponse<ExternalIdentifier>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const [identifier, target] = await Promise.all([
        transaction.externalIdentifier.findFirst({
          where: { id: identifierId, entityType, entityId },
          select: {
            id: true,
            archivedAt: true,
            verificationStatus: true,
            sourceDocumentId: true,
          },
        }),
        this.getEntityState(transaction, entityType, entityId),
      ]);
      if (!identifier) {
        throw new NotFoundException({
          message: 'External identifier not found',
          code: 'NOT_FOUND',
        });
      }
      this.assertActive(identifier.archivedAt, 'external identifier');
      this.assertActive(target.archivedAt, entityType);
      if (identifier.verificationStatus !== VerificationStatus.UNVERIFIED) {
        throw new ConflictException({
          message: 'Verified external identifiers cannot be changed through generic update',
          code: 'VERIFIED_IDENTIFIER_IMMUTABLE',
        });
      }
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? identifier.sourceDocumentId : dto.sourceDocumentId,
        target.isDemo,
      );
      const data: Prisma.ExternalIdentifierUpdateInput = {
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.validFrom !== undefined ? { validFrom: dto.validFrom } : {}),
        ...(dto.validTo !== undefined ? { validTo: dto.validTo } : {}),
        ...(dto.sourceDocumentId !== undefined
          ? {
              sourceDocument: dto.sourceDocumentId
                ? { connect: { id: dto.sourceDocumentId } }
                : { disconnect: true },
            }
          : {}),
        ...(dto.sourceReference !== undefined ? { sourceReference: dto.sourceReference } : {}),
        isDemo: target.isDemo,
      };
      if (dto.value !== undefined) data.normalizedValue = this.normalize(dto.value);
      return dataResponse(
        await transaction.externalIdentifier.update({ where: { id: identifierId }, data }),
      );
    });
  }

  private normalize(value: string): string {
    return value.normalize('NFKC').trim();
  }

  private async assertEntity(type: IdentifierEntityType, id: string): Promise<void> {
    let found: { id: string } | null;
    switch (type) {
      case 'Athlete':
        found = await this.prisma.athlete.findUnique({ where: { id }, select: { id: true } });
        break;
      case 'Horse':
        found = await this.prisma.horse.findUnique({ where: { id }, select: { id: true } });
        break;
      case 'Club':
        found = await this.prisma.club.findUnique({ where: { id }, select: { id: true } });
        break;
      case 'CompetitionEvent':
        found = await this.prisma.competitionEvent.findUnique({
          where: { id },
          select: { id: true },
        });
        break;
    }
    if (!found) throw new NotFoundException({ message: `${type} not found`, code: 'NOT_FOUND' });
  }

  private async getEntityState(
    transaction: Prisma.TransactionClient,
    type: IdentifierEntityType,
    id: string,
  ): Promise<{ archivedAt: Date | null; isDemo: boolean }> {
    let found: { archivedAt: Date | null; isDemo: boolean } | null;
    switch (type) {
      case 'Athlete':
        found = await transaction.athlete.findUnique({
          where: { id },
          select: { archivedAt: true, isDemo: true },
        });
        break;
      case 'Horse':
        found = await transaction.horse.findUnique({
          where: { id },
          select: { archivedAt: true, isDemo: true },
        });
        break;
      case 'Club':
        found = await transaction.club.findUnique({
          where: { id },
          select: { archivedAt: true, isDemo: true },
        });
        break;
      case 'CompetitionEvent':
        found = await transaction.competitionEvent.findUnique({
          where: { id },
          select: { archivedAt: true, isDemo: true },
        });
        break;
    }
    if (!found) throw new NotFoundException({ message: `${type} not found`, code: 'NOT_FOUND' });
    return found;
  }

  private assertActive(archivedAt: Date | null, resource: string): void {
    if (archivedAt) {
      throw new BadRequestException({
        message: `Archived ${resource} cannot receive identifier changes`,
        code: 'ARCHIVED_RESOURCE',
      });
    }
  }
}

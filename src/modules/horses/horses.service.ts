import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AthleteHorseRelation, Horse, HorseOwnership, Prisma } from '@prisma/client';

import { assertActiveRecord } from '../../common/database/archive-policy';
import {
  assertSourceDocumentReference,
  validateReferenceStates,
} from '../../common/database/reference-policy';
import { withSerializableTransaction } from '../../common/database/serializable-transaction';
import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import {
  archivedAtFilter,
  paginationArgs,
  type PaginationQuery,
} from '../../common/pagination/pagination.dto';
import {
  assertProfileMutable,
  assertProfilePublishable,
  assertProfileWithdrawable,
  profilePublishData,
} from '../../common/publication/profile-publication';
import { publicHorseDependenciesWhere } from '../../common/publication/public-visibility';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateHorseAthleteRelationDto,
  CreateHorseDto,
  CreateHorseOwnershipDto,
  HorseListQueryDto,
  UpdateHorseAthleteRelationDto,
  UpdateHorseDto,
  UpdateHorseOwnershipDto,
} from './dto/horse.dto';

@Injectable()
export class HorsesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: HorseListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(query.archived);
    const where: Prisma.HorseWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.sex ? { sex: { equals: query.sex, mode: 'insensitive' } } : {}),
      ...(query.breed ? { breed: { contains: query.breed, mode: 'insensitive' } } : {}),
      ...(query.color ? { color: { contains: query.color, mode: 'insensitive' } } : {}),
      ...(query.birthYear !== undefined ? { birthYear: query.birthYear } : {}),
      ...(query.countryOfBirthId ? { countryOfBirthId: query.countryOfBirthId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { passportName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.horse.findMany({
        where,
        select: {
          id: true,
          passportName: true,
          displayName: true,
          dateOfBirth: true,
          birthYear: true,
          sex: true,
          breed: true,
          color: true,
          status: true,
          isDemo: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          countryOfBirth: { select: { id: true, isoAlpha2: true, name: true } },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.horse.count({ where }),
    ]);
    const identifiers =
      data.length === 0
        ? []
        : await this.prisma.externalIdentifier.findMany({
            where: {
              entityType: 'Horse',
              entityId: { in: data.map(({ id }) => id) },
              archivedAt: null,
            },
            orderBy: [{ entityId: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              entityId: true,
              identifierType: true,
              namespace: true,
              value: true,
              verificationStatus: true,
              isPrimary: true,
            },
          });
    const primaryIdentifierByHorse = new Map<
      string,
      Omit<(typeof identifiers)[number], 'entityId'>
    >();
    for (const { entityId, ...identifier } of identifiers) {
      if (!primaryIdentifierByHorse.has(entityId)) {
        primaryIdentifierByHorse.set(entityId, identifier);
      }
    }
    return listResponse(
      data.map((horse) => ({
        ...horse,
        primaryIdentifier: primaryIdentifierByHorse.get(horse.id) ?? null,
      })),
      query.page,
      query.limit,
      total,
    );
  }

  async get(id: string): Promise<DataResponse<unknown>> {
    const [horse, identifiers] = await Promise.all([
      this.prisma.horse.findUniqueOrThrow({
        where: { id },
        include: {
          countryOfBirth: { select: { id: true, isoAlpha2: true, name: true } },
          ownerships: {
            where: { archivedAt: null },
            take: 10,
            orderBy: { startDate: 'desc' },
            include: { owner: { select: { id: true, displayName: true, status: true } } },
          },
          athleteRelations: {
            where: { archivedAt: null },
            take: 10,
            orderBy: { startDate: 'desc' },
            include: { athlete: { select: { id: true, displayName: true, status: true } } },
          },
          competitionResults: {
            where: { archivedAt: null },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              competitionClass: {
                select: {
                  id: true,
                  title: true,
                  competitionEvent: { select: { id: true, title: true, slug: true } },
                },
              },
              athlete: { select: { id: true, displayName: true } },
              status: { select: { id: true, code: true, label: true } },
            },
          },
        },
      }),
      this.prisma.externalIdentifier.findMany({
        where: { entityType: 'Horse', entityId: id, archivedAt: null },
        take: 20,
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          identifierType: true,
          namespace: true,
          value: true,
          verificationStatus: true,
          isPrimary: true,
        },
      }),
    ]);
    return dataResponse({ ...horse, externalIdentifiers: identifiers });
  }

  async create(dto: CreateHorseDto): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const [country, image] = await Promise.all([
        dto.countryOfBirthId
          ? transaction.country.findUnique({
              where: { id: dto.countryOfBirthId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.imageId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.imageId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      const isDemo = validateReferenceStates([
        ...(dto.countryOfBirthId ? [{ resourceName: 'Country', state: country }] : []),
        ...(dto.imageId ? [{ resourceName: 'Media file', state: image }] : []),
      ]);
      return dataResponse(await transaction.horse.create({ data: Object.assign({ isDemo }, dto) }));
    });
  }

  async update(id: string, dto: UpdateHorseDto): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.horse.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'horse');
      assertProfileMutable(current, 'horse');
      const [country, image] = await Promise.all([
        dto.countryOfBirthId
          ? transaction.country.findUnique({
              where: { id: dto.countryOfBirthId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.imageId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.imageId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(dto.countryOfBirthId ? [{ resourceName: 'Country', state: country }] : []),
          ...(dto.imageId ? [{ resourceName: 'Media file', state: image }] : []),
        ],
        current.isDemo,
      );
      return dataResponse(await transaction.horse.update({ where: { id }, data: dto }));
    });
  }

  async archive(id: string): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.horse.update({ where: { id }, data: { archivedAt: new Date() } }),
      ),
    );
  }

  async restore(id: string): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.horse.findUniqueOrThrow({ where: { id } });
      const [country, image] = await Promise.all([
        current.countryOfBirthId
          ? transaction.country.findUnique({
              where: { id: current.countryOfBirthId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        current.imageId
          ? transaction.mediaFile.findUnique({
              where: { id: current.imageId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(current.countryOfBirthId ? [{ resourceName: 'Country', state: country }] : []),
          ...(current.imageId ? [{ resourceName: 'Media file', state: image }] : []),
        ],
        current.isDemo,
      );
      return dataResponse(
        await transaction.horse.update({ where: { id }, data: { archivedAt: null } }),
      );
    });
  }

  async publish(id: string): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.horse.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'horse');
      assertProfilePublishable(current, 'horse');
      const now = new Date();
      const candidate = await transaction.horse.findFirst({
        where: { AND: [{ id }, publicHorseDependenciesWhere(now)] },
        select: { id: true },
      });
      if (!candidate) {
        throw new ConflictException({
          message: 'Horse publication dependencies are not publicly visible',
          code: 'PUBLICATION_DEPENDENCY_INVALID',
        });
      }
      return dataResponse(
        await transaction.horse.update({
          where: { id },
          data: profilePublishData(current),
        }),
      );
    });
  }

  async withdraw(id: string): Promise<DataResponse<Horse>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.horse.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'horse');
      assertProfileWithdrawable(current, 'horse');
      return dataResponse(
        await transaction.horse.update({
          where: { id },
          data: { publicationStatus: 'WITHDRAWN' },
        }),
      );
    });
  }

  async owners(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertHorse(id);
    const where = { horseId: id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.horseOwnership.findMany({
        where,
        include: { owner: { select: { id: true, displayName: true, status: true } } },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.horseOwnership.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async addOwner(id: string, dto: CreateHorseOwnershipDto): Promise<DataResponse<HorseOwnership>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertOwnershipParents(transaction, id, dto.ownerId);
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, isDemo);
      const data: Prisma.HorseOwnershipUncheckedCreateInput = {
        horseId: id,
        ownerId: dto.ownerId,
        startDate: dto.startDate,
        isDemo,
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.ownershipShare !== undefined ? { ownershipShare: dto.ownershipShare } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
      };
      return dataResponse(await transaction.horseOwnership.create({ data }));
    });
  }

  async updateOwner(
    id: string,
    ownershipId: string,
    dto: UpdateHorseOwnershipDto,
  ): Promise<DataResponse<HorseOwnership>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.horseOwnership.findFirst({
        where: { id: ownershipId, horseId: id },
      });
      if (!current) {
        throw new NotFoundException({ message: 'Horse ownership not found', code: 'NOT_FOUND' });
      }
      if (current.archivedAt) {
        throw new BadRequestException({
          message: 'Archived horse ownership cannot be updated',
          code: 'ARCHIVED_RESOURCE',
        });
      }
      this.assertDates(
        dto.startDate ?? current.startDate,
        dto.endDate === undefined ? current.endDate : dto.endDate,
      );
      const isDemo = await this.assertOwnershipParents(
        transaction,
        id,
        dto.ownerId ?? current.ownerId,
      );
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? current.sourceDocumentId : dto.sourceDocumentId,
        isDemo,
      );
      return dataResponse(
        await transaction.horseOwnership.update({
          where: { id: ownershipId },
          data: {
            ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
            ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
            ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
            ...(dto.ownershipShare !== undefined ? { ownershipShare: dto.ownershipShare } : {}),
            ...(dto.sourceDocumentId !== undefined
              ? { sourceDocumentId: dto.sourceDocumentId }
              : {}),
            isDemo,
          },
        }),
      );
    });
  }

  async athletes(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertHorse(id);
    const where = { horseId: id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.athleteHorseRelation.findMany({
        where,
        include: {
          athlete: { select: { id: true, displayName: true, status: true, archivedAt: true } },
          discipline: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.athleteHorseRelation.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async addAthlete(
    id: string,
    dto: CreateHorseAthleteRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertAthleteRelationParents(
        transaction,
        id,
        dto.athleteId,
        dto.disciplineId ?? null,
      );
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, isDemo);
      const data: Prisma.AthleteHorseRelationUncheckedCreateInput = {
        horseId: id,
        athleteId: dto.athleteId,
        startDate: dto.startDate,
        isDemo,
        ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
        ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
      };
      return dataResponse(await transaction.athleteHorseRelation.create({ data }));
    });
  }

  async updateAthlete(
    id: string,
    relationId: string,
    dto: UpdateHorseAthleteRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.athleteHorseRelation.findFirst({
        where: { id: relationId, horseId: id },
      });
      if (!current) {
        throw new NotFoundException({
          message: 'Athlete-horse relation not found',
          code: 'NOT_FOUND',
        });
      }
      if (current.archivedAt) {
        throw new BadRequestException({
          message: 'Archived athlete-horse relation cannot be updated',
          code: 'ARCHIVED_RESOURCE',
        });
      }
      this.assertDates(
        dto.startDate ?? current.startDate,
        dto.endDate === undefined ? current.endDate : dto.endDate,
      );
      const isDemo = await this.assertAthleteRelationParents(
        transaction,
        id,
        dto.athleteId ?? current.athleteId,
        dto.disciplineId === undefined ? current.disciplineId : dto.disciplineId,
      );
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? current.sourceDocumentId : dto.sourceDocumentId,
        isDemo,
      );
      const data: Prisma.AthleteHorseRelationUncheckedUpdateInput = {
        ...(dto.athleteId !== undefined ? { athleteId: dto.athleteId } : {}),
        ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
        ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
        isDemo,
      };
      return dataResponse(
        await transaction.athleteHorseRelation.update({
          where: { id: relationId },
          data,
        }),
      );
    });
  }

  async results(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertHorse(id);
    const where: Prisma.CompetitionResultWhereInput = {
      horseId: id,
      archivedAt: null,
      athlete: { archivedAt: null },
      competitionClass: {
        archivedAt: null,
        competitionEvent: { archivedAt: null },
      },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionResult.findMany({
        where,
        include: {
          athlete: { select: { id: true, displayName: true } },
          status: { select: { id: true, code: true, label: true } },
          competitionClass: {
            select: {
              id: true,
              title: true,
              competitionEvent: { select: { id: true, title: true, slug: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionResult.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  private async assertHorse(id: string): Promise<void> {
    const horse = await this.prisma.horse.findUnique({ where: { id }, select: { id: true } });
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
  }

  private assertDates(start: Date, end: Date | null): void {
    if (end && end < start) {
      throw new BadRequestException({
        message: 'endDate must not be earlier than startDate',
        code: 'VALIDATION_ERROR',
      });
    }
  }

  private async assertOwnershipParents(
    transaction: Prisma.TransactionClient,
    horseId: string,
    ownerId: string,
  ): Promise<boolean> {
    const [horse, owner] = await Promise.all([
      transaction.horse.findUnique({
        where: { id: horseId },
        select: { archivedAt: true, isDemo: true },
      }),
      transaction.owner.findUnique({
        where: { id: ownerId },
        select: { archivedAt: true, isDemo: true },
      }),
    ]);
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
    if (!owner) throw new NotFoundException({ message: 'Owner not found', code: 'NOT_FOUND' });
    if (horse.archivedAt || owner.archivedAt) {
      throw new BadRequestException({
        message: 'Archived horses or owners cannot receive a new or changed ownership',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (horse.isDemo !== owner.isDemo) {
      throw new BadRequestException({
        message: 'Horse and owner must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    return horse.isDemo;
  }

  private async assertAthleteRelationParents(
    transaction: Prisma.TransactionClient,
    horseId: string,
    athleteId: string,
    disciplineId: string | null,
  ): Promise<boolean> {
    const [horse, athlete, discipline] = await Promise.all([
      transaction.horse.findUnique({
        where: { id: horseId },
        select: { archivedAt: true, isDemo: true },
      }),
      transaction.athlete.findUnique({
        where: { id: athleteId },
        select: { archivedAt: true, isDemo: true },
      }),
      disciplineId
        ? transaction.discipline.findUnique({
            where: { id: disciplineId },
            select: { archivedAt: true, isDemo: true },
          })
        : Promise.resolve(null),
    ]);
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
    if (!athlete) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (disciplineId && !discipline) {
      throw new NotFoundException({ message: 'Discipline not found', code: 'NOT_FOUND' });
    }
    if (horse.archivedAt || athlete.archivedAt || discipline?.archivedAt) {
      throw new BadRequestException({
        message: 'Archived resources cannot receive a new or changed athlete-horse relation',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (
      horse.isDemo !== athlete.isDemo ||
      (discipline !== null && horse.isDemo !== discipline.isDemo)
    ) {
      throw new BadRequestException({
        message: 'Athlete-horse relation references must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    return horse.isDemo;
  }
}

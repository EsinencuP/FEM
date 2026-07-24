import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Athlete, AthleteClubMembership, AthleteHorseRelation, Prisma } from '@prisma/client';
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
import { PrismaService } from '../../database/prisma.service';
import type {
  AthleteListQueryDto,
  CreateAthleteClubMembershipDto,
  CreateAthleteDto,
  CreateAthleteHorseRelationDto,
  UpdateAthleteClubMembershipDto,
  UpdateAthleteDto,
  UpdateAthleteHorseRelationDto,
} from './dto/athlete.dto';
@Injectable()
export class AthletesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: AthleteListQueryDto): Promise<ListResponse<unknown>> {
    const identifierIds = q.search ? await this.identifierIds(q.search) : [];
    const searchOr: Prisma.AthleteWhereInput[] = q.search
      ? [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { displayName: { contains: q.search, mode: 'insensitive' } },
          ...(identifierIds.length ? [{ id: { in: identifierIds } }] : []),
        ]
      : [];
    const archivedAt = archivedAtFilter(q.archived);
    const where: Prisma.AthleteWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(q.countryId !== undefined ? { countryId: q.countryId } : {}),
      ...(q.federationId !== undefined ? { nationalFederationId: q.federationId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.clubId ? { clubMemberships: { some: { clubId: q.clubId, archivedAt: null } } } : {}),
      ...(searchOr.length ? { OR: searchOr } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.athlete.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          dateOfBirth: true,
          gender: true,
          status: true,
          isDemo: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          country: { select: { id: true, isoAlpha2: true, name: true } },
          nationalFederation: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
        ...paginationArgs(q),
      }),
      this.prisma.athlete.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  async get(id: string): Promise<DataResponse<unknown>> {
    const athlete = await this.prisma.athlete.findUniqueOrThrow({
      where: { id },
      include: {
        country: { select: { id: true, isoAlpha2: true, isoAlpha3: true, name: true } },
        nationalFederation: { select: { id: true, name: true, shortName: true } },
        clubMemberships: {
          where: { archivedAt: null, endDate: null },
          take: 10,
          orderBy: { startDate: 'desc' },
          include: { club: { select: { id: true, name: true, status: true, archivedAt: true } } },
        },
        horseRelations: {
          where: { archivedAt: null, endDate: null },
          take: 10,
          orderBy: { startDate: 'desc' },
          include: {
            horse: { select: { id: true, displayName: true, status: true, archivedAt: true } },
            discipline: { select: { id: true, code: true, name: true } },
          },
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
            horse: { select: { id: true, displayName: true } },
            status: { select: { id: true, code: true, label: true } },
          },
        },
      },
    });
    const identifiers = await this.prisma.externalIdentifier.findMany({
      where: { entityType: 'Athlete', entityId: id, archivedAt: null },
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
    });
    return dataResponse({ ...athlete, externalIdentifiers: identifiers });
  }
  async create(dto: CreateAthleteDto): Promise<DataResponse<Athlete>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const [country, federation, photo] = await Promise.all([
        dto.countryId
          ? transaction.country.findUnique({
              where: { id: dto.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.nationalFederationId
          ? transaction.nationalFederation.findUnique({
              where: { id: dto.nationalFederationId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.photoId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.photoId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      const isDemo = validateReferenceStates([
        ...(dto.countryId ? [{ resourceName: 'Country', state: country }] : []),
        ...(dto.nationalFederationId
          ? [{ resourceName: 'National federation', state: federation }]
          : []),
        ...(dto.photoId ? [{ resourceName: 'Media file', state: photo }] : []),
      ]);
      return dataResponse(
        await transaction.athlete.create({ data: Object.assign({ isDemo }, dto) }),
      );
    });
  }
  async update(id: string, dto: UpdateAthleteDto): Promise<DataResponse<Athlete>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.athlete.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'athlete');
      const [country, federation, photo] = await Promise.all([
        dto.countryId
          ? transaction.country.findUnique({
              where: { id: dto.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.nationalFederationId
          ? transaction.nationalFederation.findUnique({
              where: { id: dto.nationalFederationId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.photoId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.photoId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(dto.countryId ? [{ resourceName: 'Country', state: country }] : []),
          ...(dto.nationalFederationId
            ? [{ resourceName: 'National federation', state: federation }]
            : []),
          ...(dto.photoId ? [{ resourceName: 'Media file', state: photo }] : []),
        ],
        current.isDemo,
      );
      return dataResponse(await transaction.athlete.update({ where: { id }, data: dto }));
    });
  }
  async archive(id: string): Promise<DataResponse<Athlete>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.athlete.update({ where: { id }, data: { archivedAt: new Date() } }),
      ),
    );
  }
  async restore(id: string): Promise<DataResponse<Athlete>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.athlete.findUniqueOrThrow({ where: { id } });
      const [country, federation, photo] = await Promise.all([
        current.countryId
          ? transaction.country.findUnique({
              where: { id: current.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        current.nationalFederationId
          ? transaction.nationalFederation.findUnique({
              where: { id: current.nationalFederationId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        current.photoId
          ? transaction.mediaFile.findUnique({
              where: { id: current.photoId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(current.countryId ? [{ resourceName: 'Country', state: country }] : []),
          ...(current.nationalFederationId
            ? [{ resourceName: 'National federation', state: federation }]
            : []),
          ...(current.photoId ? [{ resourceName: 'Media file', state: photo }] : []),
        ],
        current.isDemo,
      );
      return dataResponse(
        await transaction.athlete.update({ where: { id }, data: { archivedAt: null } }),
      );
    });
  }
  async clubs(id: string, q: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertAthlete(id);
    const where = { athleteId: id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.athleteClubMembership.findMany({
        where,
        include: { club: { select: { id: true, name: true, status: true, archivedAt: true } } },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        ...paginationArgs(q),
      }),
      this.prisma.athleteClubMembership.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  async addClub(
    id: string,
    dto: CreateAthleteClubMembershipDto,
  ): Promise<DataResponse<AthleteClubMembership>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertMembershipParents(transaction, id, dto.clubId);
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, isDemo);
      const data: Prisma.AthleteClubMembershipUncheckedCreateInput = {
        athleteId: id,
        clubId: dto.clubId,
        startDate: dto.startDate,
        isDemo,
        ...(dto.membershipType !== undefined ? { membershipType: dto.membershipType } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
      };
      return dataResponse(await transaction.athleteClubMembership.create({ data }));
    });
  }
  async updateClub(
    id: string,
    membershipId: string,
    dto: UpdateAthleteClubMembershipDto,
  ): Promise<DataResponse<AthleteClubMembership>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.athleteClubMembership.findFirst({
        where: { id: membershipId, athleteId: id },
      });
      if (!current)
        throw new NotFoundException({ message: 'Club membership not found', code: 'NOT_FOUND' });
      if (current.archivedAt) {
        throw new BadRequestException({
          message: 'Archived club membership cannot be updated',
          code: 'ARCHIVED_RESOURCE',
        });
      }
      this.assertDates(
        dto.startDate ?? current.startDate,
        dto.endDate === undefined ? current.endDate : dto.endDate,
      );
      const isDemo = await this.assertMembershipParents(
        transaction,
        id,
        dto.clubId ?? current.clubId,
      );
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? current.sourceDocumentId : dto.sourceDocumentId,
        isDemo,
      );
      return dataResponse(
        await transaction.athleteClubMembership.update({
          where: { id: membershipId },
          data: {
            ...(dto.clubId !== undefined ? { clubId: dto.clubId } : {}),
            ...(dto.membershipType !== undefined ? { membershipType: dto.membershipType } : {}),
            ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
            ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
            ...(dto.sourceDocumentId !== undefined
              ? { sourceDocumentId: dto.sourceDocumentId }
              : {}),
            isDemo,
          },
        }),
      );
    });
  }
  async horses(id: string, q: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertAthlete(id);
    const where = { athleteId: id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.athleteHorseRelation.findMany({
        where,
        include: {
          horse: { select: { id: true, displayName: true, status: true, archivedAt: true } },
          discipline: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        ...paginationArgs(q),
      }),
      this.prisma.athleteHorseRelation.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  async addHorse(
    id: string,
    dto: CreateAthleteHorseRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertHorseRelationParents(
        transaction,
        id,
        dto.horseId,
        dto.disciplineId ?? null,
      );
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, isDemo);
      const data: Prisma.AthleteHorseRelationUncheckedCreateInput = {
        athleteId: id,
        horseId: dto.horseId,
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
  async updateHorse(
    id: string,
    relationId: string,
    dto: UpdateAthleteHorseRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.athleteHorseRelation.findFirst({
        where: { id: relationId, athleteId: id },
      });
      if (!current)
        throw new NotFoundException({
          message: 'Athlete-horse relation not found',
          code: 'NOT_FOUND',
        });
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
      const isDemo = await this.assertHorseRelationParents(
        transaction,
        id,
        dto.horseId ?? current.horseId,
        dto.disciplineId === undefined ? current.disciplineId : dto.disciplineId,
      );
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? current.sourceDocumentId : dto.sourceDocumentId,
        isDemo,
      );
      return dataResponse(
        await transaction.athleteHorseRelation.update({
          where: { id: relationId },
          data: {
            ...(dto.horseId !== undefined ? { horseId: dto.horseId } : {}),
            ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
            ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
            ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
            ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
            ...(dto.sourceDocumentId !== undefined
              ? { sourceDocumentId: dto.sourceDocumentId }
              : {}),
            isDemo,
          },
        }),
      );
    });
  }
  async results(id: string, q: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertAthlete(id);
    const where: Prisma.CompetitionResultWhereInput = {
      athleteId: id,
      archivedAt: null,
      horse: { archivedAt: null },
      competitionClass: {
        archivedAt: null,
        competitionEvent: { archivedAt: null },
      },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionResult.findMany({
        where,
        include: {
          horse: { select: { id: true, displayName: true } },
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
        ...paginationArgs(q),
      }),
      this.prisma.competitionResult.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  private async assertAthlete(id: string): Promise<void> {
    if (!(await this.prisma.athlete.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
  }
  private assertDates(start: Date, end: Date | null): void {
    if (end && end < start)
      throw new BadRequestException({
        message: 'endDate must not be earlier than startDate',
        code: 'VALIDATION_ERROR',
      });
  }
  private async identifierIds(search: string): Promise<string[]> {
    const rows = await this.prisma.externalIdentifier.findMany({
      where: {
        entityType: 'Athlete',
        archivedAt: null,
        OR: [
          { value: { contains: search, mode: 'insensitive' } },
          { normalizedValue: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { entityId: true },
      take: 200,
    });
    return [...new Set(rows.map((r) => r.entityId))];
  }

  private async assertMembershipParents(
    transaction: Prisma.TransactionClient,
    athleteId: string,
    clubId: string,
  ): Promise<boolean> {
    const [athlete, club] = await Promise.all([
      transaction.athlete.findUnique({
        where: { id: athleteId },
        select: { archivedAt: true, isDemo: true },
      }),
      transaction.club.findUnique({
        where: { id: clubId },
        select: { archivedAt: true, isDemo: true },
      }),
    ]);
    if (!athlete) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (!club) throw new NotFoundException({ message: 'Club not found', code: 'NOT_FOUND' });
    if (athlete.archivedAt || club.archivedAt) {
      throw new BadRequestException({
        message: 'Archived athletes or clubs cannot receive a new or changed membership',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (athlete.isDemo !== club.isDemo) {
      throw new BadRequestException({
        message: 'Athlete and club must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    return athlete.isDemo;
  }

  private async assertHorseRelationParents(
    transaction: Prisma.TransactionClient,
    athleteId: string,
    horseId: string,
    disciplineId: string | null,
  ): Promise<boolean> {
    const [athlete, horse, discipline] = await Promise.all([
      transaction.athlete.findUnique({
        where: { id: athleteId },
        select: { archivedAt: true, isDemo: true },
      }),
      transaction.horse.findUnique({
        where: { id: horseId },
        select: { archivedAt: true, isDemo: true },
      }),
      disciplineId
        ? transaction.discipline.findUnique({
            where: { id: disciplineId },
            select: { archivedAt: true, isDemo: true },
          })
        : Promise.resolve(null),
    ]);
    if (!athlete) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
    if (disciplineId && !discipline) {
      throw new NotFoundException({ message: 'Discipline not found', code: 'NOT_FOUND' });
    }
    if (athlete.archivedAt || horse.archivedAt || discipline?.archivedAt) {
      throw new BadRequestException({
        message: 'Archived resources cannot receive a new or changed athlete-horse relation',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (
      athlete.isDemo !== horse.isDemo ||
      (discipline !== null && athlete.isDemo !== discipline.isDemo)
    ) {
      throw new BadRequestException({
        message: 'Athlete-horse relation references must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    return athlete.isDemo;
  }
}

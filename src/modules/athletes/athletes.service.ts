import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Athlete, AthleteClubMembership, AthleteHorseRelation, Prisma } from '@prisma/client';
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
    return dataResponse(await this.prisma.athlete.create({ data: dto }));
  }
  async update(id: string, dto: UpdateAthleteDto): Promise<DataResponse<Athlete>> {
    return dataResponse(await this.prisma.athlete.update({ where: { id }, data: dto }));
  }
  async archive(id: string): Promise<DataResponse<Athlete>> {
    return dataResponse(
      await this.prisma.athlete.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }
  async restore(id: string): Promise<DataResponse<Athlete>> {
    return dataResponse(
      await this.prisma.athlete.update({ where: { id }, data: { archivedAt: null } }),
    );
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
    await this.assertAthlete(id);
    const data: Prisma.AthleteClubMembershipUncheckedCreateInput = {
      athleteId: id,
      clubId: dto.clubId,
      startDate: dto.startDate,
      ...(dto.membershipType !== undefined ? { membershipType: dto.membershipType } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
    };
    return dataResponse(await this.prisma.athleteClubMembership.create({ data }));
  }
  async updateClub(
    id: string,
    membershipId: string,
    dto: UpdateAthleteClubMembershipDto,
  ): Promise<DataResponse<AthleteClubMembership>> {
    const current = await this.prisma.athleteClubMembership.findFirst({
      where: { id: membershipId, athleteId: id },
    });
    if (!current)
      throw new NotFoundException({ message: 'Club membership not found', code: 'NOT_FOUND' });
    this.assertDates(
      dto.startDate ?? current.startDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );
    return dataResponse(
      await this.prisma.athleteClubMembership.update({ where: { id: membershipId }, data: dto }),
    );
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
    await this.assertAthlete(id);
    const data: Prisma.AthleteHorseRelationUncheckedCreateInput = {
      athleteId: id,
      horseId: dto.horseId,
      startDate: dto.startDate,
      ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
      ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
    };
    return dataResponse(await this.prisma.athleteHorseRelation.create({ data }));
  }
  async updateHorse(
    id: string,
    relationId: string,
    dto: UpdateAthleteHorseRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    const current = await this.prisma.athleteHorseRelation.findFirst({
      where: { id: relationId, athleteId: id },
    });
    if (!current)
      throw new NotFoundException({
        message: 'Athlete-horse relation not found',
        code: 'NOT_FOUND',
      });
    this.assertDates(
      dto.startDate ?? current.startDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );
    return dataResponse(
      await this.prisma.athleteHorseRelation.update({ where: { id: relationId }, data: dto }),
    );
  }
  async results(id: string, q: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertAthlete(id);
    const where = { athleteId: id };
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
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AthleteHorseRelation, Horse, HorseOwnership, Prisma } from '@prisma/client';

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
          countryOfBirth: { select: { id: true, isoAlpha2: true, name: true } },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.horse.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.horse.findUniqueOrThrow({
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
        },
      }),
    );
  }

  async create(dto: CreateHorseDto): Promise<DataResponse<Horse>> {
    return dataResponse(await this.prisma.horse.create({ data: dto }));
  }

  async update(id: string, dto: UpdateHorseDto): Promise<DataResponse<Horse>> {
    return dataResponse(await this.prisma.horse.update({ where: { id }, data: dto }));
  }

  async archive(id: string): Promise<DataResponse<Horse>> {
    return dataResponse(
      await this.prisma.horse.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }

  async restore(id: string): Promise<DataResponse<Horse>> {
    return dataResponse(
      await this.prisma.horse.update({ where: { id }, data: { archivedAt: null } }),
    );
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
    await this.assertHorse(id);
    const data: Prisma.HorseOwnershipUncheckedCreateInput = {
      horseId: id,
      ownerId: dto.ownerId,
      startDate: dto.startDate,
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.ownershipShare !== undefined ? { ownershipShare: dto.ownershipShare } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
    };
    return dataResponse(await this.prisma.horseOwnership.create({ data }));
  }

  async updateOwner(
    id: string,
    ownershipId: string,
    dto: UpdateHorseOwnershipDto,
  ): Promise<DataResponse<HorseOwnership>> {
    const current = await this.prisma.horseOwnership.findFirst({
      where: { id: ownershipId, horseId: id },
    });
    if (!current) {
      throw new NotFoundException({ message: 'Horse ownership not found', code: 'NOT_FOUND' });
    }
    this.assertDates(
      dto.startDate ?? current.startDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );
    return dataResponse(
      await this.prisma.horseOwnership.update({ where: { id: ownershipId }, data: dto }),
    );
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
    await this.assertHorse(id);
    const data: Prisma.AthleteHorseRelationUncheckedCreateInput = {
      horseId: id,
      athleteId: dto.athleteId,
      startDate: dto.startDate,
      ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
      ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
    };
    return dataResponse(await this.prisma.athleteHorseRelation.create({ data }));
  }

  async updateAthlete(
    id: string,
    relationId: string,
    dto: UpdateHorseAthleteRelationDto,
  ): Promise<DataResponse<AthleteHorseRelation>> {
    const current = await this.prisma.athleteHorseRelation.findFirst({
      where: { id: relationId, horseId: id },
    });
    if (!current) {
      throw new NotFoundException({
        message: 'Athlete-horse relation not found',
        code: 'NOT_FOUND',
      });
    }
    this.assertDates(
      dto.startDate ?? current.startDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );
    const data: Prisma.AthleteHorseRelationUncheckedUpdateInput = {
      ...(dto.athleteId !== undefined ? { athleteId: dto.athleteId } : {}),
      ...(dto.relationType !== undefined ? { relationType: dto.relationType } : {}),
      ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
    };
    return dataResponse(
      await this.prisma.athleteHorseRelation.update({
        where: { id: relationId },
        data,
      }),
    );
  }

  async results(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    await this.assertHorse(id);
    const where = { horseId: id };
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
}

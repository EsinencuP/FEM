import { BadRequestException, Injectable } from '@nestjs/common';
import type { CompetitionClass, Prisma } from '@prisma/client';

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
  CompetitionClassListQueryDto,
  CreateCompetitionClassDto,
  UpdateCompetitionClassDto,
} from './dto/competition-class.dto';

@Injectable()
export class CompetitionClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CompetitionClassListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(query.archived);
    const where: Prisma.CompetitionClassWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.competitionEventId ? { competitionEventId: query.competitionEventId } : {}),
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
      ...(query.category ? { category: { contains: query.category, mode: 'insensitive' } } : {}),
      ...(query.level ? { level: { contains: query.level, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.competitionDate ? { competitionDate: query.competitionDate } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionClass.findMany({
        where,
        include: {
          competitionEvent: { select: { id: true, title: true, slug: true } },
          discipline: { select: { id: true, code: true, name: true } },
          _count: { select: { results: true } },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionClass.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.competitionClass.findUniqueOrThrow({
        where: { id },
        include: {
          competitionEvent: {
            select: { id: true, title: true, slug: true, startDate: true, endDate: true },
          },
          discipline: { select: { id: true, code: true, name: true } },
        },
      }),
    );
  }

  async create(dto: CreateCompetitionClassDto): Promise<DataResponse<CompetitionClass>> {
    await this.assertDate(dto.competitionEventId, dto.competitionDate ?? null);
    const data: Prisma.CompetitionClassUncheckedCreateInput = {
      competitionEventId: dto.competitionEventId,
      title: dto.title,
      disciplineId: dto.disciplineId,
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.level !== undefined ? { level: dto.level } : {}),
      ...(dto.competitionDate !== undefined ? { competitionDate: dto.competitionDate } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
    return dataResponse(await this.prisma.competitionClass.create({ data }));
  }

  async update(
    id: string,
    dto: UpdateCompetitionClassDto,
  ): Promise<DataResponse<CompetitionClass>> {
    const current = await this.prisma.competitionClass.findUniqueOrThrow({ where: { id } });
    await this.assertDate(
      dto.competitionEventId ?? current.competitionEventId,
      dto.competitionDate === undefined ? current.competitionDate : dto.competitionDate,
    );
    const data: Prisma.CompetitionClassUncheckedUpdateInput = {
      ...(dto.competitionEventId !== undefined
        ? { competitionEventId: dto.competitionEventId }
        : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.disciplineId !== undefined ? { disciplineId: dto.disciplineId } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.level !== undefined ? { level: dto.level } : {}),
      ...(dto.competitionDate !== undefined ? { competitionDate: dto.competitionDate } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
    return dataResponse(await this.prisma.competitionClass.update({ where: { id }, data }));
  }

  async archive(id: string): Promise<DataResponse<CompetitionClass>> {
    return dataResponse(
      await this.prisma.competitionClass.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionClass>> {
    return dataResponse(
      await this.prisma.competitionClass.update({ where: { id }, data: { archivedAt: null } }),
    );
  }

  async results(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    const where = { competitionClassId: id, archivedAt: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionResult.findMany({
        where,
        include: {
          athlete: { select: { id: true, displayName: true } },
          horse: { select: { id: true, displayName: true } },
          status: { select: { id: true, code: true, label: true } },
        },
        orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionResult.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  private async assertDate(eventId: string, date: Date | null): Promise<void> {
    const event = await this.prisma.competitionEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: { startDate: true, endDate: true, archivedAt: true },
    });
    if (event.archivedAt) {
      throw new BadRequestException({
        message: 'An archived competition cannot receive new or changed classes',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (date && (date < event.startDate || date > event.endDate)) {
      throw new BadRequestException({
        message: 'competitionDate must be within the competition event period',
        code: 'VALIDATION_ERROR',
      });
    }
  }
}

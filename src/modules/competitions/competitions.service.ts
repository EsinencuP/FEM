import { BadRequestException, Injectable } from '@nestjs/common';
import { PublicationStatus, type CompetitionEvent, type Prisma } from '@prisma/client';

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
  CompetitionListQueryDto,
  CreateCompetitionDto,
  UpdateCompetitionDto,
} from './dto/competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CompetitionListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(query.archived);
    const where: Prisma.CompetitionEventWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.disciplineId ? { classes: { some: { disciplineId: query.disciplineId } } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.publicationStatus ? { publicationStatus: query.publicationStatus } : {}),
      ...(query.dateFrom ? { endDate: { gte: query.dateFrom } } : {}),
      ...((query.dateTo !== undefined || query.upcoming === true) && {
        AND: [
          ...(query.dateTo ? [{ startDate: { lte: query.dateTo } }] : []),
          ...(query.upcoming ? [{ startDate: { gte: new Date() } }] : []),
        ],
      }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { venue: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionEvent.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          endDate: true,
          location: true,
          venue: true,
          status: true,
          publicationStatus: true,
          publishedAt: true,
          archivedAt: true,
          country: { select: { id: true, isoAlpha2: true, name: true } },
          _count: { select: { classes: true } },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionEvent.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.competitionEvent.findUniqueOrThrow({
        where: { id },
        include: {
          country: { select: { id: true, isoAlpha2: true, name: true } },
          classes: {
            where: { archivedAt: null },
            take: 50,
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { discipline: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
    );
  }

  async getBySlug(slug: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.competitionEvent.findUniqueOrThrow({
        where: { slug },
        include: { country: { select: { id: true, isoAlpha2: true, name: true } } },
      }),
    );
  }

  async create(dto: CreateCompetitionDto): Promise<DataResponse<CompetitionEvent>> {
    this.assertDates(dto.startDate, dto.endDate);
    const data: Prisma.CompetitionEventUncheckedCreateInput = {
      title: dto.title,
      slug: dto.slug,
      startDate: dto.startDate,
      endDate: dto.endDate,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
      ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
      ...(dto.organizerName !== undefined ? { organizerName: dto.organizerName } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.publicationStatus !== undefined ? { publicationStatus: dto.publicationStatus } : {}),
      ...(dto.coverMediaId !== undefined ? { coverMediaId: dto.coverMediaId } : {}),
      ...(dto.publicationStatus === PublicationStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
    };
    return dataResponse(
      await this.prisma.competitionEvent.create({
        data,
      }),
    );
  }

  async update(id: string, dto: UpdateCompetitionDto): Promise<DataResponse<CompetitionEvent>> {
    const current = await this.prisma.competitionEvent.findUniqueOrThrow({ where: { id } });
    this.assertDates(dto.startDate ?? current.startDate, dto.endDate ?? current.endDate);
    const data: Prisma.CompetitionEventUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
      ...(dto.countryId !== undefined
        ? { country: dto.countryId ? { connect: { id: dto.countryId } } : { disconnect: true } }
        : {}),
      ...(dto.organizerName !== undefined ? { organizerName: dto.organizerName } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.publicationStatus !== undefined ? { publicationStatus: dto.publicationStatus } : {}),
      ...(dto.coverMediaId !== undefined
        ? {
            coverMedia: dto.coverMediaId
              ? { connect: { id: dto.coverMediaId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.publicationStatus === PublicationStatus.PUBLISHED && current.publishedAt === null
        ? { publishedAt: new Date() }
        : {}),
      ...(dto.publicationStatus !== undefined &&
      dto.publicationStatus !== PublicationStatus.PUBLISHED
        ? { publishedAt: null }
        : {}),
    };
    return dataResponse(await this.prisma.competitionEvent.update({ where: { id }, data }));
  }

  async archive(id: string): Promise<DataResponse<CompetitionEvent>> {
    return dataResponse(
      await this.prisma.competitionEvent.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionEvent>> {
    return dataResponse(
      await this.prisma.competitionEvent.update({ where: { id }, data: { archivedAt: null } }),
    );
  }

  async classes(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    const where = { competitionEventId: id, archivedAt: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionClass.findMany({
        where,
        include: { discipline: { select: { id: true, code: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionClass.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async results(id: string, query: PaginationQuery): Promise<ListResponse<unknown>> {
    const where = { competitionClass: { competitionEventId: id }, archivedAt: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionResult.findMany({
        where,
        include: {
          athlete: { select: { id: true, displayName: true } },
          horse: { select: { id: true, displayName: true } },
          status: { select: { id: true, code: true, label: true } },
          competitionClass: { select: { id: true, title: true } },
        },
        orderBy: [{ competitionClassId: 'asc' }, { rank: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionResult.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  private assertDates(startDate: Date, endDate: Date): void {
    if (endDate < startDate) {
      throw new BadRequestException({
        message: 'endDate must not be earlier than startDate',
        code: 'VALIDATION_ERROR',
      });
    }
  }
}

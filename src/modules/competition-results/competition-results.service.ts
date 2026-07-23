import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PublicationStatus,
  type CompetitionResult,
  type Prisma,
  type ResultMetric,
} from '@prisma/client';

import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type {
  CompetitionResultListQueryDto,
  CreateCompetitionResultDto,
  CreateResultMetricDto,
  UpdateCompetitionResultDto,
  UpdateResultMetricDto,
} from './dto/competition-result.dto';

@Injectable()
export class CompetitionResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CompetitionResultListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(query.archived);
    const competitionClassFilter: Prisma.CompetitionClassWhereInput = {
      ...(query.competitionEventId ? { competitionEventId: query.competitionEventId } : {}),
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
    };
    const where: Prisma.CompetitionResultWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.competitionEventId || query.disciplineId
        ? { competitionClass: competitionClassFilter }
        : {}),
      ...(query.competitionClassId ? { competitionClassId: query.competitionClassId } : {}),
      ...(query.athleteId ? { athleteId: query.athleteId } : {}),
      ...(query.horseId ? { horseId: query.horseId } : {}),
      ...(query.statusId ? { statusId: query.statusId } : {}),
      ...(query.statusCode
        ? { status: { code: { equals: query.statusCode, mode: 'insensitive' } } }
        : {}),
      ...(query.publicationStatus ? { publicationStatus: query.publicationStatus } : {}),
      ...(query.hasRank === true ? { rank: { not: null } } : {}),
      ...(query.hasRank === false ? { rank: null } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionResult.findMany({
        where,
        include: {
          competitionClass: {
            select: {
              id: true,
              title: true,
              discipline: { select: { id: true, code: true, name: true } },
              competitionEvent: { select: { id: true, title: true, slug: true } },
            },
          },
          athlete: { select: { id: true, displayName: true } },
          horse: { select: { id: true, displayName: true } },
          status: { select: { id: true, code: true, label: true } },
          metrics: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 100 },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.competitionResult.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.competitionResult.findUniqueOrThrow({
        where: { id },
        include: {
          competitionClass: { include: { competitionEvent: true, discipline: true } },
          athlete: { select: { id: true, displayName: true } },
          horse: { select: { id: true, displayName: true } },
          status: true,
          metrics: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        },
      }),
    );
  }

  async create(dto: CreateCompetitionResultDto): Promise<DataResponse<CompetitionResult>> {
    await this.assertReferences(dto.competitionClassId, dto.athleteId, dto.horseId);
    const data: Prisma.CompetitionResultUncheckedCreateInput = {
      competitionClassId: dto.competitionClassId,
      athleteId: dto.athleteId,
      horseId: dto.horseId,
      ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
      ...(dto.statusId !== undefined ? { statusId: dto.statusId } : {}),
      ...(dto.resultDisplay !== undefined ? { resultDisplay: dto.resultDisplay } : {}),
      ...(dto.penalties !== undefined ? { penalties: dto.penalties } : {}),
      ...(dto.timeSeconds !== undefined ? { timeSeconds: dto.timeSeconds } : {}),
      ...(dto.points !== undefined ? { points: dto.points } : {}),
      ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
      ...(dto.sourceReference !== undefined ? { sourceReference: dto.sourceReference } : {}),
      ...(dto.publicationStatus !== undefined ? { publicationStatus: dto.publicationStatus } : {}),
      ...(dto.publicationStatus === PublicationStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      ...(dto.metrics
        ? {
            metrics: {
              create: dto.metrics.map((metric) => ({
                metricCode: metric.metricCode,
                ...(metric.numericValue !== undefined ? { numericValue: metric.numericValue } : {}),
                ...(metric.textValue !== undefined ? { textValue: metric.textValue } : {}),
                ...(metric.unit !== undefined ? { unit: metric.unit } : {}),
                ...(metric.sortOrder !== undefined ? { sortOrder: metric.sortOrder } : {}),
              })),
            },
          }
        : {}),
    };
    return dataResponse(await this.prisma.competitionResult.create({ data }));
  }

  async update(
    id: string,
    dto: UpdateCompetitionResultDto,
  ): Promise<DataResponse<CompetitionResult>> {
    const current = await this.prisma.competitionResult.findUniqueOrThrow({ where: { id } });
    await this.assertReferences(
      dto.competitionClassId ?? current.competitionClassId,
      dto.athleteId ?? current.athleteId,
      dto.horseId ?? current.horseId,
    );
    const data: Prisma.CompetitionResultUncheckedUpdateInput = {
      ...(dto.competitionClassId !== undefined
        ? { competitionClassId: dto.competitionClassId }
        : {}),
      ...(dto.athleteId !== undefined ? { athleteId: dto.athleteId } : {}),
      ...(dto.horseId !== undefined ? { horseId: dto.horseId } : {}),
      ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
      ...(dto.statusId !== undefined ? { statusId: dto.statusId } : {}),
      ...(dto.resultDisplay !== undefined ? { resultDisplay: dto.resultDisplay } : {}),
      ...(dto.penalties !== undefined ? { penalties: dto.penalties } : {}),
      ...(dto.timeSeconds !== undefined ? { timeSeconds: dto.timeSeconds } : {}),
      ...(dto.points !== undefined ? { points: dto.points } : {}),
      ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
      ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
      ...(dto.sourceReference !== undefined ? { sourceReference: dto.sourceReference } : {}),
      ...(dto.publicationStatus !== undefined ? { publicationStatus: dto.publicationStatus } : {}),
      ...(dto.publicationStatus === PublicationStatus.PUBLISHED && current.publishedAt === null
        ? { publishedAt: new Date() }
        : {}),
      ...(dto.publicationStatus !== undefined &&
      dto.publicationStatus !== PublicationStatus.PUBLISHED
        ? { publishedAt: null }
        : {}),
    };
    return dataResponse(await this.prisma.competitionResult.update({ where: { id }, data }));
  }

  async archive(id: string): Promise<DataResponse<CompetitionResult>> {
    return dataResponse(
      await this.prisma.competitionResult.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionResult>> {
    return dataResponse(
      await this.prisma.competitionResult.update({ where: { id }, data: { archivedAt: null } }),
    );
  }

  async addMetric(
    resultId: string,
    dto: CreateResultMetricDto,
  ): Promise<DataResponse<ResultMetric>> {
    await this.prisma.competitionResult.findUniqueOrThrow({ where: { id: resultId } });
    const data: Prisma.ResultMetricUncheckedCreateInput = {
      competitionResultId: resultId,
      metricCode: dto.metricCode,
      ...(dto.numericValue !== undefined ? { numericValue: dto.numericValue } : {}),
      ...(dto.textValue !== undefined ? { textValue: dto.textValue } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
    return dataResponse(
      await this.prisma.resultMetric.create({
        data,
      }),
    );
  }

  async updateMetric(
    resultId: string,
    metricId: string,
    dto: UpdateResultMetricDto,
  ): Promise<DataResponse<ResultMetric>> {
    const metric = await this.prisma.resultMetric.findFirst({
      where: { id: metricId, competitionResultId: resultId },
    });
    if (!metric)
      throw new NotFoundException({ message: 'Result metric not found', code: 'NOT_FOUND' });
    const numeric = dto.numericValue === undefined ? metric.numericValue : dto.numericValue;
    const text = dto.textValue === undefined ? metric.textValue : dto.textValue;
    if ((numeric !== null) === (text !== null)) {
      throw new BadRequestException({
        message: 'Exactly one of numericValue or textValue must be present',
        code: 'VALIDATION_ERROR',
      });
    }
    return dataResponse(
      await this.prisma.resultMetric.update({ where: { id: metricId }, data: dto }),
    );
  }

  async deleteMetric(resultId: string, metricId: string): Promise<void> {
    const result = await this.prisma.resultMetric.deleteMany({
      where: { id: metricId, competitionResultId: resultId },
    });
    if (result.count === 0) {
      throw new NotFoundException({ message: 'Result metric not found', code: 'NOT_FOUND' });
    }
  }

  private async assertReferences(
    classId: string,
    athleteId: string,
    horseId: string,
  ): Promise<void> {
    const [competitionClass, athlete, horse] = await Promise.all([
      this.prisma.competitionClass.findUnique({
        where: { id: classId },
        select: { archivedAt: true, competitionEvent: { select: { archivedAt: true } } },
      }),
      this.prisma.athlete.findUnique({ where: { id: athleteId }, select: { archivedAt: true } }),
      this.prisma.horse.findUnique({ where: { id: horseId }, select: { archivedAt: true } }),
    ]);
    if (!competitionClass) {
      throw new NotFoundException({ message: 'Competition class not found', code: 'NOT_FOUND' });
    }
    if (!athlete) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
    if (
      competitionClass.archivedAt ||
      competitionClass.competitionEvent.archivedAt ||
      athlete.archivedAt ||
      horse.archivedAt
    ) {
      throw new BadRequestException({
        message: 'Archived resources cannot be used for a new or changed result',
        code: 'ARCHIVED_RESOURCE',
      });
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CompetitionResult,
  type Prisma,
  type PublicationStatus,
  type ResultMetric,
} from '@prisma/client';

import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { assertSourceDocumentReference } from '../../common/database/reference-policy';
import { withSerializableTransaction } from '../../common/database/serializable-transaction';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type {
  CompetitionResultListQueryDto,
  CreateCompetitionResultDto,
  CreateResultMetricDto,
  UpdateCompetitionResultDto,
  UpdateResultMetricDto,
} from './dto/competition-result.dto';

const MAX_RESULT_METRICS = 100;
const RESULT_LIST_METRIC_PREVIEW = 10;

@Injectable()
export class CompetitionResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CompetitionResultListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(query.archived);
    const competitionClassFilter: Prisma.CompetitionClassWhereInput = {
      ...(query.competitionEventId ? { competitionEventId: query.competitionEventId } : {}),
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
      ...(query.archived === 'false'
        ? { archivedAt: null, competitionEvent: { archivedAt: null } }
        : {}),
    };
    const where: Prisma.CompetitionResultWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.competitionEventId || query.disciplineId || query.archived === 'false'
        ? { competitionClass: competitionClassFilter }
        : {}),
      ...(query.archived === 'false'
        ? { athlete: { archivedAt: null }, horse: { archivedAt: null } }
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
          metrics: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: RESULT_LIST_METRIC_PREVIEW,
          },
          _count: { select: { metrics: true } },
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
          metrics: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: MAX_RESULT_METRICS,
          },
          _count: { select: { metrics: true } },
        },
      }),
    );
  }

  async create(dto: CreateCompetitionResultDto): Promise<DataResponse<CompetitionResult>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertReferences(
        transaction,
        dto.competitionClassId,
        dto.athleteId,
        dto.horseId,
        dto.statusId ?? null,
      );
      await assertSourceDocumentReference(transaction, dto.sourceDocumentId, isDemo);
      const data: Prisma.CompetitionResultUncheckedCreateInput = {
        competitionClassId: dto.competitionClassId,
        athleteId: dto.athleteId,
        horseId: dto.horseId,
        isDemo,
        ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
        ...(dto.statusId !== undefined ? { statusId: dto.statusId } : {}),
        ...(dto.resultDisplay !== undefined ? { resultDisplay: dto.resultDisplay } : {}),
        ...(dto.penalties !== undefined ? { penalties: dto.penalties } : {}),
        ...(dto.timeSeconds !== undefined ? { timeSeconds: dto.timeSeconds } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
        ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
        ...(dto.sourceDocumentId !== undefined ? { sourceDocumentId: dto.sourceDocumentId } : {}),
        ...(dto.sourceReference !== undefined ? { sourceReference: dto.sourceReference } : {}),
        ...(dto.metrics
          ? {
              metrics: {
                create: dto.metrics.map((metric) => ({
                  metricCode: metric.metricCode,
                  isDemo,
                  ...(metric.numericValue !== undefined
                    ? { numericValue: metric.numericValue }
                    : {}),
                  ...(metric.textValue !== undefined ? { textValue: metric.textValue } : {}),
                  ...(metric.unit !== undefined ? { unit: metric.unit } : {}),
                  ...(metric.sortOrder !== undefined ? { sortOrder: metric.sortOrder } : {}),
                })),
              },
            }
          : {}),
      };
      return dataResponse(await transaction.competitionResult.create({ data }));
    });
  }

  async update(
    id: string,
    dto: UpdateCompetitionResultDto,
  ): Promise<DataResponse<CompetitionResult>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionResult.findUniqueOrThrow({ where: { id } });
      if (current.archivedAt) {
        throw new BadRequestException({
          message: 'Restore an archived result before updating it',
          code: 'ARCHIVED_RESOURCE',
        });
      }
      const isDemo = await this.assertReferences(
        transaction,
        dto.competitionClassId ?? current.competitionClassId,
        dto.athleteId ?? current.athleteId,
        dto.horseId ?? current.horseId,
        dto.statusId === undefined ? current.statusId : dto.statusId,
      );
      const metricCount = await transaction.resultMetric.count({
        where: { competitionResultId: id },
      });
      if (isDemo !== current.isDemo && metricCount > 0) {
        throw new ConflictException({
          message: 'A result with metrics cannot cross the demo boundary',
          code: 'DEMO_BOUNDARY_REPARENT_CONFLICT',
        });
      }
      await assertSourceDocumentReference(
        transaction,
        dto.sourceDocumentId === undefined ? current.sourceDocumentId : dto.sourceDocumentId,
        isDemo,
      );
      this.assertOutcome({
        rank: dto.rank === undefined ? current.rank : dto.rank,
        statusId: dto.statusId === undefined ? current.statusId : dto.statusId,
        resultDisplay: dto.resultDisplay === undefined ? current.resultDisplay : dto.resultDisplay,
        penalties: dto.penalties === undefined ? current.penalties : dto.penalties,
        timeSeconds: dto.timeSeconds === undefined ? current.timeSeconds : dto.timeSeconds,
        points: dto.points === undefined ? current.points : dto.points,
        bonus: dto.bonus === undefined ? current.bonus : dto.bonus,
        metricCount,
      });
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
        isDemo,
      };
      return dataResponse(await transaction.competitionResult.update({ where: { id }, data }));
    });
  }

  async archive(id: string): Promise<DataResponse<CompetitionResult>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.competitionResult.update({
          where: { id },
          data: { archivedAt: new Date() },
        }),
      ),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionResult>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionResult.findUniqueOrThrow({ where: { id } });
      const isDemo = await this.assertReferences(
        transaction,
        current.competitionClassId,
        current.athleteId,
        current.horseId,
        current.statusId,
      );
      await assertSourceDocumentReference(transaction, current.sourceDocumentId, isDemo);
      return dataResponse(
        await transaction.competitionResult.update({
          where: { id },
          data: { archivedAt: null, isDemo },
        }),
      );
    });
  }

  async addMetric(
    resultId: string,
    dto: CreateResultMetricDto,
  ): Promise<DataResponse<ResultMetric>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const result = await transaction.competitionResult.findUniqueOrThrow({
        where: { id: resultId },
        select: {
          archivedAt: true,
          isDemo: true,
          publicationStatus: true,
          publishedAt: true,
          approvedAt: true,
        },
      });
      this.assertNotArchived(result.archivedAt, 'result');
      this.assertMetricsMutable(result);
      const metricCount = await transaction.resultMetric.count({
        where: { competitionResultId: resultId },
      });
      if (metricCount >= MAX_RESULT_METRICS) {
        throw new ConflictException({
          message: `A result cannot contain more than ${String(MAX_RESULT_METRICS)} metrics`,
          code: 'RESULT_METRIC_LIMIT',
        });
      }
      const data: Prisma.ResultMetricUncheckedCreateInput = {
        competitionResultId: resultId,
        metricCode: dto.metricCode,
        isDemo: result.isDemo,
        ...(dto.numericValue !== undefined ? { numericValue: dto.numericValue } : {}),
        ...(dto.textValue !== undefined ? { textValue: dto.textValue } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      };
      return dataResponse(await transaction.resultMetric.create({ data }));
    });
  }

  async updateMetric(
    resultId: string,
    metricId: string,
    dto: UpdateResultMetricDto,
  ): Promise<DataResponse<ResultMetric>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const metric = await transaction.resultMetric.findFirst({
        where: { id: metricId, competitionResultId: resultId },
        include: {
          competitionResult: {
            select: {
              archivedAt: true,
              publicationStatus: true,
              publishedAt: true,
              approvedAt: true,
            },
          },
        },
      });
      if (!metric)
        throw new NotFoundException({ message: 'Result metric not found', code: 'NOT_FOUND' });
      this.assertNotArchived(metric.competitionResult.archivedAt, 'result');
      this.assertMetricsMutable(metric.competitionResult);
      const numeric = dto.numericValue === undefined ? metric.numericValue : dto.numericValue;
      const text = dto.textValue === undefined ? metric.textValue : dto.textValue;
      if (
        (numeric !== null) === (text !== null) ||
        (typeof text === 'string' && text.trim().length === 0)
      ) {
        throw new BadRequestException({
          message: 'Exactly one of numericValue or textValue must be present',
          code: 'VALIDATION_ERROR',
        });
      }
      return dataResponse(
        await transaction.resultMetric.update({ where: { id: metricId }, data: dto }),
      );
    });
  }

  async deleteMetric(resultId: string, metricId: string): Promise<void> {
    await withSerializableTransaction(this.prisma, async (transaction) => {
      const metric = await transaction.resultMetric.findFirst({
        where: { id: metricId, competitionResultId: resultId },
        include: { competitionResult: true },
      });
      if (!metric) {
        throw new NotFoundException({ message: 'Result metric not found', code: 'NOT_FOUND' });
      }
      this.assertNotArchived(metric.competitionResult.archivedAt, 'result');
      this.assertMetricsMutable(metric.competitionResult);
      const metricCount = await transaction.resultMetric.count({
        where: { competitionResultId: resultId },
      });
      this.assertOutcome({
        ...metric.competitionResult,
        metricCount: metricCount - 1,
      });
      await transaction.resultMetric.delete({ where: { id: metricId } });
    });
  }

  private async assertReferences(
    transaction: Prisma.TransactionClient,
    classId: string,
    athleteId: string,
    horseId: string,
    statusId: string | null,
  ): Promise<boolean> {
    const [competitionClass, athlete, horse, status] = await Promise.all([
      transaction.competitionClass.findUnique({
        where: { id: classId },
        select: {
          archivedAt: true,
          isDemo: true,
          competitionEvent: { select: { archivedAt: true, isDemo: true } },
        },
      }),
      transaction.athlete.findUnique({
        where: { id: athleteId },
        select: { archivedAt: true, isDemo: true },
      }),
      transaction.horse.findUnique({
        where: { id: horseId },
        select: { archivedAt: true, isDemo: true },
      }),
      statusId
        ? transaction.resultStatus.findUnique({
            where: { id: statusId },
            select: { archivedAt: true, isDemo: true },
          })
        : Promise.resolve(null),
    ]);
    if (!competitionClass) {
      throw new NotFoundException({ message: 'Competition class not found', code: 'NOT_FOUND' });
    }
    if (!athlete) throw new NotFoundException({ message: 'Athlete not found', code: 'NOT_FOUND' });
    if (!horse) throw new NotFoundException({ message: 'Horse not found', code: 'NOT_FOUND' });
    if (statusId && !status) {
      throw new NotFoundException({ message: 'Result status not found', code: 'NOT_FOUND' });
    }
    if (
      competitionClass.archivedAt ||
      competitionClass.competitionEvent.archivedAt ||
      athlete.archivedAt ||
      horse.archivedAt ||
      status?.archivedAt
    ) {
      throw new BadRequestException({
        message: 'Archived resources cannot be used for a new or changed result',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    const demoFlags = [
      competitionClass.isDemo,
      competitionClass.competitionEvent.isDemo,
      athlete.isDemo,
      horse.isDemo,
      ...(status ? [status.isDemo] : []),
    ];
    if (demoFlags.some((value) => value !== demoFlags[0])) {
      throw new BadRequestException({
        message: 'Result references must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    return competitionClass.isDemo;
  }

  private assertMetricsMutable(result: {
    publicationStatus: PublicationStatus;
    publishedAt: Date | null;
    approvedAt: Date | null;
  }): void {
    if (
      result.publicationStatus !== 'DRAFT' ||
      result.publishedAt !== null ||
      result.approvedAt !== null
    ) {
      throw new ConflictException({
        message: 'Metrics of a published or approved result cannot be changed',
        code: 'RESULT_METRIC_IMMUTABLE',
      });
    }
  }

  private assertNotArchived(archivedAt: Date | null, resource: string): void {
    if (archivedAt) {
      throw new BadRequestException({
        message: `Restore the archived ${resource} before changing it`,
        code: 'ARCHIVED_RESOURCE',
      });
    }
  }

  private assertOutcome(value: {
    rank: unknown;
    statusId: string | null;
    resultDisplay: string | null;
    penalties: unknown;
    timeSeconds: unknown;
    points: unknown;
    bonus: unknown;
    metricCount: number;
  }): void {
    const hasDirectOutcome =
      value.rank != null ||
      value.statusId != null ||
      (typeof value.resultDisplay === 'string' && value.resultDisplay.length > 0) ||
      value.penalties != null ||
      value.timeSeconds != null ||
      value.points != null ||
      value.bonus != null;
    if (!hasDirectOutcome && value.metricCount === 0) {
      throw new BadRequestException({
        message: 'At least one result outcome or metric must remain',
        code: 'RESULT_OUTCOME_REQUIRED',
      });
    }
  }
}

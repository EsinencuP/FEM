import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
import { withSerializableTransaction } from '../../common/database/serializable-transaction';
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
      ...(query.archived === 'false'
        ? { competitionEvent: { archivedAt: null }, discipline: { archivedAt: null } }
        : {}),
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
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const isDemo = await this.assertReferences(
        transaction,
        dto.competitionEventId,
        dto.disciplineId,
        dto.competitionDate ?? null,
      );
      const data: Prisma.CompetitionClassUncheckedCreateInput = {
        competitionEventId: dto.competitionEventId,
        title: dto.title,
        disciplineId: dto.disciplineId,
        isDemo,
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.competitionDate !== undefined ? { competitionDate: dto.competitionDate } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      };
      return dataResponse(await transaction.competitionClass.create({ data }));
    });
  }

  async update(
    id: string,
    dto: UpdateCompetitionClassDto,
  ): Promise<DataResponse<CompetitionClass>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionClass.findUniqueOrThrow({ where: { id } });
      if (current.archivedAt) {
        throw new BadRequestException({
          message: 'Restore an archived competition class before updating it',
          code: 'ARCHIVED_RESOURCE',
        });
      }
      const isDemo = await this.assertReferences(
        transaction,
        dto.competitionEventId ?? current.competitionEventId,
        dto.disciplineId ?? current.disciplineId,
        dto.competitionDate === undefined ? current.competitionDate : dto.competitionDate,
      );
      if (isDemo !== current.isDemo) {
        const resultCount = await transaction.competitionResult.count({
          where: { competitionClassId: id },
        });
        if (resultCount > 0) {
          throw new ConflictException({
            message: 'A competition class with results cannot cross the demo boundary',
            code: 'DEMO_BOUNDARY_REPARENT_CONFLICT',
          });
        }
      }
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
        isDemo,
      };
      return dataResponse(await transaction.competitionClass.update({ where: { id }, data }));
    });
  }

  async archive(id: string): Promise<DataResponse<CompetitionClass>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.competitionClass.update({
          where: { id },
          data: { archivedAt: new Date() },
        }),
      ),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionClass>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionClass.findUniqueOrThrow({ where: { id } });
      const isDemo = await this.assertReferences(
        transaction,
        current.competitionEventId,
        current.disciplineId,
        current.competitionDate,
      );
      return dataResponse(
        await transaction.competitionClass.update({
          where: { id },
          data: { archivedAt: null, isDemo },
        }),
      );
    });
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

  private async assertReferences(
    transaction: Prisma.TransactionClient,
    eventId: string,
    disciplineId: string,
    date: Date | null,
  ): Promise<boolean> {
    const [event, discipline] = await Promise.all([
      transaction.competitionEvent.findUniqueOrThrow({
        where: { id: eventId },
        select: { startDate: true, endDate: true, archivedAt: true, isDemo: true },
      }),
      transaction.discipline.findUniqueOrThrow({
        where: { id: disciplineId },
        select: { archivedAt: true, isDemo: true },
      }),
    ]);
    if (event.archivedAt) {
      throw new BadRequestException({
        message: 'An archived competition cannot receive new or changed classes',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (discipline.archivedAt) {
      throw new BadRequestException({
        message: 'An archived discipline cannot be used by a competition class',
        code: 'ARCHIVED_RESOURCE',
      });
    }
    if (event.isDemo !== discipline.isDemo) {
      throw new BadRequestException({
        message: 'Competition event and discipline must share the same demo boundary',
        code: 'DEMO_BOUNDARY_CONFLICT',
      });
    }
    if (date && (date < event.startDate || date > event.endDate)) {
      throw new BadRequestException({
        message: 'competitionDate must be within the competition event period',
        code: 'VALIDATION_ERROR',
      });
    }
    return event.isDemo;
  }
}

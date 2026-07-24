import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { CompetitionEvent, Prisma } from '@prisma/client';

import { assertActiveRecord } from '../../common/database/archive-policy';
import { validateReferenceStates } from '../../common/database/reference-policy';
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
import { publicEventDependenciesWhere } from '../../common/publication/public-visibility';
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
          isDemo: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
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
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const [country, coverMedia] = await Promise.all([
        dto.countryId
          ? transaction.country.findUnique({
              where: { id: dto.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.coverMediaId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.coverMediaId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      const isDemo = validateReferenceStates([
        ...(dto.countryId ? [{ resourceName: 'Country', state: country }] : []),
        ...(dto.coverMediaId ? [{ resourceName: 'Media file', state: coverMedia }] : []),
      ]);
      const data: Prisma.CompetitionEventUncheckedCreateInput = {
        title: dto.title,
        slug: dto.slug,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isDemo,
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
        ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
        ...(dto.organizerName !== undefined ? { organizerName: dto.organizerName } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.coverMediaId !== undefined ? { coverMediaId: dto.coverMediaId } : {}),
      };
      return dataResponse(await transaction.competitionEvent.create({ data }));
    });
  }

  async update(id: string, dto: UpdateCompetitionDto): Promise<DataResponse<CompetitionEvent>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionEvent.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'competition');
      if (dto.slug !== undefined && dto.slug !== current.slug && current.publishedAt !== null) {
        throw new ConflictException({
          message: 'A competition slug is immutable after first publication',
          code: 'PUBLISHED_SLUG_IMMUTABLE',
        });
      }
      if (
        current.publicationStatus === 'PUBLISHED' &&
        dto.status !== undefined &&
        !['ACTIVE', 'INACTIVE'].includes(dto.status)
      ) {
        throw new ConflictException({
          message: 'Withdraw a published competition before hiding it through lifecycle status',
          code: 'PUBLISHED_EVENT_STATUS_REQUIRES_WITHDRAWAL',
        });
      }
      const [country, coverMedia] = await Promise.all([
        dto.countryId
          ? transaction.country.findUnique({
              where: { id: dto.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        dto.coverMediaId
          ? transaction.mediaFile.findUnique({
              where: { id: dto.coverMediaId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(dto.countryId ? [{ resourceName: 'Country', state: country }] : []),
          ...(dto.coverMediaId ? [{ resourceName: 'Media file', state: coverMedia }] : []),
        ],
        current.isDemo,
      );
      const startDate = dto.startDate ?? current.startDate;
      const endDate = dto.endDate ?? current.endDate;
      this.assertDates(startDate, endDate);

      const invalidClass = await transaction.competitionClass.findFirst({
        where: {
          competitionEventId: id,
          competitionDate: { not: null },
          OR: [{ competitionDate: { lt: startDate } }, { competitionDate: { gt: endDate } }],
        },
        select: { id: true },
      });
      if (invalidClass) {
        throw new BadRequestException({
          message: 'The event period cannot exclude an existing competition class date',
          code: 'CLASS_DATE_OUTSIDE_EVENT',
        });
      }

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
        ...(dto.coverMediaId !== undefined
          ? {
              coverMedia: dto.coverMediaId
                ? { connect: { id: dto.coverMediaId } }
                : { disconnect: true },
            }
          : {}),
      };
      return dataResponse(await transaction.competitionEvent.update({ where: { id }, data }));
    });
  }

  async archive(id: string): Promise<DataResponse<CompetitionEvent>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.competitionEvent.update({
          where: { id },
          data: { archivedAt: new Date() },
        }),
      ),
    );
  }

  async restore(id: string): Promise<DataResponse<CompetitionEvent>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionEvent.findUniqueOrThrow({ where: { id } });
      const [country, coverMedia] = await Promise.all([
        current.countryId
          ? transaction.country.findUnique({
              where: { id: current.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        current.coverMediaId
          ? transaction.mediaFile.findUnique({
              where: { id: current.coverMediaId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(current.countryId ? [{ resourceName: 'Country', state: country }] : []),
          ...(current.coverMediaId ? [{ resourceName: 'Media file', state: coverMedia }] : []),
        ],
        current.isDemo,
      );
      return dataResponse(
        await transaction.competitionEvent.update({
          where: { id },
          data: { archivedAt: null },
        }),
      );
    });
  }

  async publish(id: string): Promise<DataResponse<CompetitionEvent>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionEvent.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'competition');
      if (current.isDemo) {
        throw new ConflictException({
          message: 'Demo competitions cannot be published',
          code: 'DEMO_PUBLICATION_FORBIDDEN',
        });
      }
      if (current.publicationStatus === 'PUBLISHED') {
        throw new ConflictException({
          message: 'Competition is already published',
          code: 'ALREADY_PUBLISHED',
        });
      }
      if (!['ACTIVE', 'INACTIVE'].includes(current.status)) {
        throw new ConflictException({
          message: 'Competition must be active or inactive before publication',
          code: 'PUBLICATION_STATE_INVALID',
        });
      }
      const publicCandidate = await transaction.competitionEvent.findFirst({
        where: { AND: [{ id }, publicEventDependenciesWhere(new Date())] },
        select: { id: true },
      });
      if (!publicCandidate) {
        throw new ConflictException({
          message: 'Competition has a dependency that is not eligible for public display',
          code: 'PUBLICATION_DEPENDENCY_INVALID',
        });
      }
      const [country, coverMedia] = await Promise.all([
        current.countryId
          ? transaction.country.findUnique({
              where: { id: current.countryId },
              select: { archivedAt: true, isDemo: true },
            })
          : Promise.resolve(null),
        current.coverMediaId
          ? transaction.mediaFile.findUnique({
              where: { id: current.coverMediaId },
              select: { archivedAt: true, isDemo: true, status: true },
            })
          : Promise.resolve(null),
      ]);
      validateReferenceStates(
        [
          ...(current.countryId ? [{ resourceName: 'Country', state: country }] : []),
          ...(current.coverMediaId ? [{ resourceName: 'Media file', state: coverMedia }] : []),
        ],
        current.isDemo,
      );
      if (coverMedia && coverMedia.status !== 'ACTIVE') {
        throw new ConflictException({
          message: 'Competition cover media must be active before publication',
          code: 'PUBLICATION_DEPENDENCY_INVALID',
        });
      }
      return dataResponse(
        await transaction.competitionEvent.update({
          where: { id },
          data: {
            publicationStatus: 'PUBLISHED',
            publishedAt: current.publishedAt ?? new Date(),
          },
        }),
      );
    });
  }

  async withdraw(id: string): Promise<DataResponse<CompetitionEvent>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.competitionEvent.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'competition');
      if (current.publicationStatus !== 'PUBLISHED') {
        throw new ConflictException({
          message: 'Only a published competition can be withdrawn',
          code: 'PUBLICATION_STATE_INVALID',
        });
      }
      return dataResponse(
        await transaction.competitionEvent.update({
          where: { id },
          data: { publicationStatus: 'WITHDRAWN' },
        }),
      );
    });
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
          competitionClass: {
            select: {
              id: true,
              title: true,
              competitionEvent: { select: { id: true, title: true, slug: true } },
            },
          },
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

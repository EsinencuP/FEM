import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { paginationArgs } from '../../common/pagination/pagination.dto';
import {
  publicAthleteWhere,
  publicClassWhere,
  publicClubWhere,
  publicCountryWhere,
  publicDisciplineWhere,
  publicEventWhere,
  publicHorseWhere,
  publicResultWhere,
  publicStatusWhere,
} from '../../common/publication/public-visibility';
import { PrismaService } from '../../database/prisma.service';
import type {
  PublicAthleteListQueryDto,
  PublicClubListQueryDto,
  PublicCompetitionClassListQueryDto,
  PublicCompetitionListQueryDto,
  PublicCountryListQueryDto,
  PublicDisciplineListQueryDto,
  PublicHorseListQueryDto,
  PublicResultListQueryDto,
} from './dto/public-api.dto';

const PUBLIC_RESULT_DETAIL_METRIC_LIMIT = 100;

const countrySelect = {
  id: true,
  isoAlpha2: true,
  isoAlpha3: true,
  name: true,
} satisfies Prisma.CountrySelect;

const federationSelect = {
  id: true,
  name: true,
  shortName: true,
  websiteUrl: true,
  country: { select: countrySelect },
} satisfies Prisma.NationalFederationSelect;

const disciplineSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
} satisfies Prisma.DisciplineSelect;

const clubSelect = {
  id: true,
  name: true,
  country: { select: countrySelect },
  nationalFederation: { select: federationSelect },
} satisfies Prisma.ClubSelect;

const athleteSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  country: { select: countrySelect },
  nationalFederation: { select: federationSelect },
} satisfies Prisma.AthleteSelect;

const horseSelect = {
  id: true,
  passportName: true,
  displayName: true,
  birthYear: true,
  sex: true,
  breed: true,
  color: true,
  studbook: true,
  countryOfBirth: { select: countrySelect },
} satisfies Prisma.HorseSelect;

const competitionSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  location: true,
  venue: true,
  organizerName: true,
  publishedAt: true,
  country: { select: countrySelect },
} satisfies Prisma.CompetitionEventSelect;

const competitionSummarySelect = {
  id: true,
  slug: true,
  title: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.CompetitionEventSelect;

const competitionClassSelect = {
  id: true,
  title: true,
  category: true,
  level: true,
  competitionDate: true,
  sortOrder: true,
  discipline: { select: disciplineSelect },
  competitionEvent: { select: competitionSummarySelect },
} satisfies Prisma.CompetitionClassSelect;

const athleteSummarySelect = {
  id: true,
  displayName: true,
} satisfies Prisma.AthleteSelect;

const horseSummarySelect = {
  id: true,
  displayName: true,
} satisfies Prisma.HorseSelect;

const resultStatusSelect = {
  id: true,
  code: true,
  label: true,
  description: true,
  sortOrder: true,
} satisfies Prisma.ResultStatusSelect;

const metricSelect = {
  metricCode: true,
  numericValue: true,
  textValue: true,
  unit: true,
  sortOrder: true,
} satisfies Prisma.ResultMetricSelect;

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Public resource not found',
    code: 'NOT_FOUND',
  });
}

function utcCalendarDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class PublicApiService {
  constructor(private readonly prisma: PrismaService) {}

  async countries(query: PublicCountryListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const where: Prisma.CountryWhereInput = {
      ...publicCountryWhere(now),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { isoAlpha2: { contains: query.search, mode: 'insensitive' } },
              { isoAlpha3: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.country.findMany({
          where,
          select: countrySelect,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          ...paginationArgs(query),
        }),
        this.prisma.country.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async disciplines(query: PublicDisciplineListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const where: Prisma.DisciplineWhereInput = {
      ...publicDisciplineWhere(now),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.discipline.findMany({
          where,
          select: disciplineSelect,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          ...paginationArgs(query),
        }),
        this.prisma.discipline.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async clubs(query: PublicClubListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const where: Prisma.ClubWhereInput = {
      ...publicClubWhere(now),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.federationId ? { nationalFederationId: query.federationId } : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.club.findMany({
          where,
          select: clubSelect,
          orderBy: [{ name: query.sortOrder }, { id: 'asc' }],
          ...paginationArgs(query),
        }),
        this.prisma.club.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async club(id: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.club.findFirst({
      where: { AND: [publicClubWhere(now), { id }] },
      select: clubSelect,
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  async athletes(query: PublicAthleteListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const today = utcCalendarDayStart(now);
    const where: Prisma.AthleteWhereInput = {
      ...publicAthleteWhere(now),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.federationId ? { nationalFederationId: query.federationId } : {}),
      ...(query.clubId
        ? {
            clubMemberships: {
              some: {
                clubId: query.clubId,
                archivedAt: null,
                isDemo: false,
                startDate: { lte: today },
                OR: [{ endDate: null }, { endDate: { gte: today } }],
                club: { is: publicClubWhere(now) },
              },
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.athlete.findMany({
          where,
          select: athleteSelect,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          ...paginationArgs(query),
        }),
        this.prisma.athlete.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async athlete(id: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.athlete.findFirst({
      where: { AND: [publicAthleteWhere(now), { id }] },
      select: athleteSelect,
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  async horses(query: PublicHorseListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const today = utcCalendarDayStart(now);
    const where: Prisma.HorseWhereInput = {
      ...publicHorseWhere(now),
      ...(query.search
        ? {
            OR: [
              { passportName: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.birthYear !== undefined ? { birthYear: query.birthYear } : {}),
      ...(query.sex ? { sex: { equals: query.sex, mode: 'insensitive' } } : {}),
      ...(query.breed ? { breed: { contains: query.breed, mode: 'insensitive' } } : {}),
      ...(query.color ? { color: { contains: query.color, mode: 'insensitive' } } : {}),
      ...(query.countryOfBirthId ? { countryOfBirthId: query.countryOfBirthId } : {}),
      ...(query.athleteId
        ? {
            athleteRelations: {
              some: {
                athleteId: query.athleteId,
                archivedAt: null,
                isDemo: false,
                startDate: { lte: today },
                OR: [{ endDate: null }, { endDate: { gte: today } }],
                athlete: { is: publicAthleteWhere(now) },
              },
            },
          }
        : {}),
    };
    const orderBy: Prisma.HorseOrderByWithRelationInput[] = [
      {
        [query.sortBy]:
          query.sortBy === 'passportName' || query.sortBy === 'birthYear'
            ? { sort: query.sortOrder, nulls: 'last' }
            : query.sortOrder,
      },
      { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.horse.findMany({
          where,
          select: horseSelect,
          orderBy,
          ...paginationArgs(query),
        }),
        this.prisma.horse.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async horse(id: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.horse.findFirst({
      where: { AND: [publicHorseWhere(now), { id }] },
      select: horseSelect,
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  async competitions(query: PublicCompetitionListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const today = utcCalendarDayStart(now);
    const startDate =
      query.dateTo || query.upcoming === true
        ? {
            ...(query.upcoming === true ? { gte: today } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          }
        : undefined;
    const where: Prisma.CompetitionEventWhereInput = {
      ...publicEventWhere(now),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { venue: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.disciplineId
        ? {
            classes: {
              some: {
                ...publicStatusWhere,
                disciplineId: query.disciplineId,
                discipline: { is: publicDisciplineWhere(now) },
              },
            },
          }
        : {}),
      ...(query.dateFrom ? { endDate: { gte: query.dateFrom } } : {}),
      ...(startDate ? { startDate } : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.competitionEvent.findMany({
          where,
          select: competitionSelect,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          ...paginationArgs(query),
        }),
        this.prisma.competitionEvent.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async competition(slug: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.competitionEvent.findFirst({
      where: { AND: [publicEventWhere(now), { slug }] },
      select: competitionSelect,
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  async competitionClasses(
    query: PublicCompetitionClassListQueryDto,
  ): Promise<ListResponse<unknown>> {
    const now = new Date();
    const competitionDate =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          }
        : undefined;
    const where: Prisma.CompetitionClassWhereInput = {
      ...publicClassWhere(now),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              { level: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.competitionSlug
        ? { competitionEvent: { is: { ...publicEventWhere(now), slug: query.competitionSlug } } }
        : {}),
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.level ? { level: { equals: query.level, mode: 'insensitive' } } : {}),
      ...(competitionDate ? { competitionDate } : {}),
    };
    const nullableSort = query.sortBy === 'competitionDate';
    const orderBy: Prisma.CompetitionClassOrderByWithRelationInput[] = [
      {
        [query.sortBy]: nullableSort ? { sort: query.sortOrder, nulls: 'last' } : query.sortOrder,
      },
      { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.competitionClass.findMany({
          where,
          select: competitionClassSelect,
          orderBy,
          ...paginationArgs(query),
        }),
        this.prisma.competitionClass.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async competitionClass(id: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.competitionClass.findFirst({
      where: { AND: [publicClassWhere(now), { id }] },
      select: competitionClassSelect,
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  async results(query: PublicResultListQueryDto): Promise<ListResponse<unknown>> {
    const now = new Date();
    const filteredClassWhere: Prisma.CompetitionClassWhereInput = {
      ...publicClassWhere(now),
      ...(query.competitionSlug
        ? {
            competitionEvent: {
              is: { ...publicEventWhere(now), slug: query.competitionSlug },
            },
          }
        : {}),
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
    };
    const where: Prisma.CompetitionResultWhereInput = {
      ...publicResultWhere(now),
      competitionClass: { is: filteredClassWhere },
      ...(query.competitionClassId ? { competitionClassId: query.competitionClassId } : {}),
      ...(query.athleteId ? { athleteId: query.athleteId } : {}),
      ...(query.horseId ? { horseId: query.horseId } : {}),
      ...(query.statusCode
        ? {
            status: {
              is: {
                ...publicStatusWhere,
                code: { equals: query.statusCode, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(query.hasRank === true ? { rank: { not: null } } : {}),
      ...(query.hasRank === false ? { rank: null } : {}),
    };
    const orderBy: Prisma.CompetitionResultOrderByWithRelationInput[] = [
      {
        [query.sortBy]: { sort: query.sortOrder, nulls: 'last' },
      },
      { id: 'asc' },
    ];
    const select = this.resultSelect(PUBLIC_RESULT_DETAIL_METRIC_LIMIT);
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.competitionResult.findMany({
          where,
          select,
          orderBy,
          ...paginationArgs(query),
        }),
        this.prisma.competitionResult.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return listResponse(data, query.page, query.limit, total);
  }

  async result(id: string): Promise<DataResponse<unknown>> {
    const now = new Date();
    const data = await this.prisma.competitionResult.findFirst({
      where: { AND: [publicResultWhere(now), { id }] },
      select: this.resultSelect(PUBLIC_RESULT_DETAIL_METRIC_LIMIT),
    });
    if (!data) throw notFound();
    return dataResponse(data);
  }

  private resultSelect(metricLimit: number): Prisma.CompetitionResultSelect {
    return {
      id: true,
      rank: true,
      resultDisplay: true,
      penalties: true,
      timeSeconds: true,
      points: true,
      bonus: true,
      publishedAt: true,
      competitionClass: { select: competitionClassSelect },
      athlete: { select: athleteSummarySelect },
      horse: { select: horseSummarySelect },
      status: { select: resultStatusSelect },
      metrics: {
        where: { isDemo: false },
        select: metricSelect,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        take: metricLimit,
      },
    };
  }
}

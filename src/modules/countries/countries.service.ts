import { Injectable } from '@nestjs/common';
import type { Country, Prisma } from '@prisma/client';

import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CountryListQueryDto, CreateCountryDto, UpdateCountryDto } from './dto/country.dto';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CountryListQueryDto): Promise<ListResponse<Country>> {
    const archivedAt = archivedAtFilter(query.archived);
    const where: Prisma.CountryWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
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
    const orderBy: Prisma.CountryOrderByWithRelationInput[] = [
      { [query.sortBy]: query.sortOrder },
      { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction([
      this.prisma.country.findMany({ where, orderBy, ...paginationArgs(query) }),
      this.prisma.country.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<Country>> {
    return dataResponse(await this.prisma.country.findUniqueOrThrow({ where: { id } }));
  }

  async create(dto: CreateCountryDto): Promise<DataResponse<Country>> {
    return dataResponse(await this.prisma.country.create({ data: dto }));
  }

  async update(id: string, dto: UpdateCountryDto): Promise<DataResponse<Country>> {
    return dataResponse(await this.prisma.country.update({ where: { id }, data: dto }));
  }

  async archive(id: string): Promise<DataResponse<Country>> {
    return dataResponse(
      await this.prisma.country.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }

  async restore(id: string): Promise<DataResponse<Country>> {
    return dataResponse(
      await this.prisma.country.update({ where: { id }, data: { archivedAt: null } }),
    );
  }
}

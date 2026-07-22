import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { dataResponse, listResponse } from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CountryListQueryDto, CreateCountryDto, UpdateCountryDto } from './dto/country.dto';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CountryListQueryDto) {
    const where: Prisma.CountryWhereInput = {
      archivedAt: archivedAtFilter(query.archived),
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

  async get(id: string) {
    return dataResponse(await this.prisma.country.findUniqueOrThrow({ where: { id } }));
  }

  async create(dto: CreateCountryDto) {
    return dataResponse(await this.prisma.country.create({ data: dto }));
  }

  async update(id: string, dto: UpdateCountryDto) {
    return dataResponse(await this.prisma.country.update({ where: { id }, data: dto }));
  }

  async archive(id: string) {
    return dataResponse(
      await this.prisma.country.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }

  async restore(id: string) {
    return dataResponse(
      await this.prisma.country.update({ where: { id }, data: { archivedAt: null } }),
    );
  }
}

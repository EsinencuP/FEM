import { Injectable } from '@nestjs/common';
import type { Discipline, Prisma } from '@prisma/client';
import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateDisciplineDto,
  DisciplineListQueryDto,
  UpdateDisciplineDto,
} from './dto/discipline.dto';

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: DisciplineListQueryDto): Promise<ListResponse<Discipline>> {
    const archivedAt = archivedAtFilter(query.archived);
    const where: Prisma.DisciplineWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.discipline.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.discipline.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }
  async get(id: string): Promise<DataResponse<Discipline>> {
    return dataResponse(await this.prisma.discipline.findUniqueOrThrow({ where: { id } }));
  }
  async create(dto: CreateDisciplineDto): Promise<DataResponse<Discipline>> {
    return dataResponse(await this.prisma.discipline.create({ data: dto }));
  }
  async update(id: string, dto: UpdateDisciplineDto): Promise<DataResponse<Discipline>> {
    return dataResponse(await this.prisma.discipline.update({ where: { id }, data: dto }));
  }
  async archive(id: string): Promise<DataResponse<Discipline>> {
    return dataResponse(
      await this.prisma.discipline.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }
  async restore(id: string): Promise<DataResponse<Discipline>> {
    return dataResponse(
      await this.prisma.discipline.update({ where: { id }, data: { archivedAt: null } }),
    );
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { dataResponse, listResponse } from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateDisciplineDto, DisciplineListQueryDto, UpdateDisciplineDto } from './dto/discipline.dto';

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: DisciplineListQueryDto) {
    const where: Prisma.DisciplineWhereInput = {
      archivedAt: archivedAtFilter(query.archived), status: query.status,
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [data,total] = await this.prisma.$transaction([
      this.prisma.discipline.findMany({ where, orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }], ...paginationArgs(query) }),
      this.prisma.discipline.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }
  async get(id:string) { return dataResponse(await this.prisma.discipline.findUniqueOrThrow({where:{id}})); }
  async create(dto:CreateDisciplineDto) { return dataResponse(await this.prisma.discipline.create({data:dto})); }
  async update(id:string,dto:UpdateDisciplineDto) { return dataResponse(await this.prisma.discipline.update({where:{id},data:dto})); }
  async archive(id:string) { return dataResponse(await this.prisma.discipline.update({where:{id},data:{archivedAt:new Date()}})); }
  async restore(id:string) { return dataResponse(await this.prisma.discipline.update({where:{id},data:{archivedAt:null}})); }
}

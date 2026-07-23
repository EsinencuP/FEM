import { Injectable } from '@nestjs/common';
import type { Club, Prisma } from '@prisma/client';
import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { ClubListQueryDto, CreateClubDto, UpdateClubDto } from './dto/club.dto';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: ClubListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(q.archived);
    const where: Prisma.ClubWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(q.countryId !== undefined ? { countryId: q.countryId } : {}),
      ...(q.federationId !== undefined ? { nationalFederationId: q.federationId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { legalName: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.club.findMany({
        where,
        select: {
          id: true,
          name: true,
          legalName: true,
          status: true,
          isDemo: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
          country: { select: { id: true, isoAlpha2: true, name: true } },
          nationalFederation: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
        ...paginationArgs(q),
      }),
      this.prisma.club.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.club.findUniqueOrThrow({
        where: { id },
        include: {
          country: { select: { id: true, isoAlpha2: true, isoAlpha3: true, name: true } },
          nationalFederation: { select: { id: true, name: true, shortName: true } },
          memberships: {
            where: { archivedAt: null },
            orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }],
            take: 10,
            select: {
              id: true,
              athleteId: true,
              membershipType: true,
              startDate: true,
              endDate: true,
              athlete: { select: { id: true, displayName: true, status: true, archivedAt: true } },
            },
          },
          _count: { select: { memberships: { where: { archivedAt: null, endDate: null } } } },
        },
      }),
    );
  }
  async create(dto: CreateClubDto): Promise<DataResponse<Club>> {
    return dataResponse(await this.prisma.club.create({ data: dto }));
  }
  async update(id: string, dto: UpdateClubDto): Promise<DataResponse<Club>> {
    return dataResponse(await this.prisma.club.update({ where: { id }, data: dto }));
  }
  async archive(id: string): Promise<DataResponse<Club>> {
    return dataResponse(
      await this.prisma.club.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }
  async restore(id: string): Promise<DataResponse<Club>> {
    return dataResponse(
      await this.prisma.club.update({ where: { id }, data: { archivedAt: null } }),
    );
  }
}

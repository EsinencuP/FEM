import { Injectable } from '@nestjs/common';
import type { Owner, Prisma } from '@prisma/client';
import { assertActiveRecord } from '../../common/database/archive-policy';
import { validateReferenceStates } from '../../common/database/reference-policy';
import { withSerializableTransaction } from '../../common/database/serializable-transaction';
import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { archivedAtFilter, paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { CreateOwnerDto, OwnerListQueryDto, UpdateOwnerDto } from './dto/owner.dto';
@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: OwnerListQueryDto): Promise<ListResponse<unknown>> {
    const archivedAt = archivedAtFilter(q.archived);
    const where: Prisma.OwnerWhereInput = {
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(q.countryId !== undefined ? { countryId: q.countryId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.search ? { displayName: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.owner.findMany({
        where,
        include: { country: { select: { id: true, isoAlpha2: true, name: true } } },
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
        ...paginationArgs(q),
      }),
      this.prisma.owner.count({ where }),
    ]);
    return listResponse(data, q.page, q.limit, total);
  }
  async get(id: string): Promise<DataResponse<unknown>> {
    return dataResponse(
      await this.prisma.owner.findUniqueOrThrow({
        where: { id },
        include: {
          country: { select: { id: true, isoAlpha2: true, name: true } },
          ownerships: {
            where: { archivedAt: null },
            orderBy: { startDate: 'desc' },
            take: 20,
            include: {
              horse: { select: { id: true, displayName: true, status: true, archivedAt: true } },
            },
          },
        },
      }),
    );
  }
  async create(dto: CreateOwnerDto): Promise<DataResponse<Owner>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const country = dto.countryId
        ? await transaction.country.findUnique({
            where: { id: dto.countryId },
            select: { archivedAt: true, isDemo: true },
          })
        : null;
      const isDemo = validateReferenceStates(
        dto.countryId ? [{ resourceName: 'Country', state: country }] : [],
      );
      return dataResponse(await transaction.owner.create({ data: Object.assign({ isDemo }, dto) }));
    });
  }
  async update(id: string, dto: UpdateOwnerDto): Promise<DataResponse<Owner>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.owner.findUniqueOrThrow({ where: { id } });
      assertActiveRecord(current, 'owner');
      const country = dto.countryId
        ? await transaction.country.findUnique({
            where: { id: dto.countryId },
            select: { archivedAt: true, isDemo: true },
          })
        : null;
      validateReferenceStates(
        dto.countryId ? [{ resourceName: 'Country', state: country }] : [],
        current.isDemo,
      );
      return dataResponse(await transaction.owner.update({ where: { id }, data: dto }));
    });
  }
  async archive(id: string): Promise<DataResponse<Owner>> {
    return withSerializableTransaction(this.prisma, async (transaction) =>
      dataResponse(
        await transaction.owner.update({ where: { id }, data: { archivedAt: new Date() } }),
      ),
    );
  }
  async restore(id: string): Promise<DataResponse<Owner>> {
    return withSerializableTransaction(this.prisma, async (transaction) => {
      const current = await transaction.owner.findUniqueOrThrow({ where: { id } });
      const country = current.countryId
        ? await transaction.country.findUnique({
            where: { id: current.countryId },
            select: { archivedAt: true, isDemo: true },
          })
        : null;
      validateReferenceStates(
        current.countryId ? [{ resourceName: 'Country', state: country }] : [],
        current.isDemo,
      );
      return dataResponse(
        await transaction.owner.update({ where: { id }, data: { archivedAt: null } }),
      );
    });
  }
}

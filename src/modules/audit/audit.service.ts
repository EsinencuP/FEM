import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  dataResponse,
  listResponse,
  type DataResponse,
  type ListResponse,
} from '../../common/dto/api-response';
import { paginationArgs } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import type { AuditLogListQueryDto } from './dto/audit.dto';

const auditProjection = {
  id: true,
  actorId: true,
  sessionId: true,
  action: true,
  entityType: true,
  entityId: true,
  oldData: true,
  newData: true,
  reason: true,
  requestId: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

type AuditProjection = Prisma.AuditLogGetPayload<{ select: typeof auditProjection }>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogListQueryDto): Promise<ListResponse<AuditProjection>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditProjection,
        orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
        ...paginationArgs(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return listResponse(data, query.page, query.limit, total);
  }

  async get(id: string): Promise<DataResponse<AuditProjection>> {
    return dataResponse(
      await this.prisma.auditLog.findUniqueOrThrow({
        where: { id },
        select: auditProjection,
      }),
    );
  }
}

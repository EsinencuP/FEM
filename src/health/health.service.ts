import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { HealthResponseDto } from './health-response.dto';

export const HEALTH_QUERY_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error('Database health query timed out'));
          }, HEALTH_QUERY_TIMEOUT_MS);
        }),
      ]);

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

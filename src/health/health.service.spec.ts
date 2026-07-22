import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  let service: HealthService;

  beforeEach(async () => {
    queryRaw.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
      ],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  it('reports a connected database', async () => {
    queryRaw.mockResolvedValue([{ connected: 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a safe service unavailable error when PostgreSQL cannot be reached', async () => {
    queryRaw.mockRejectedValue(new Error('credentials must not be exposed'));

    await expect(service.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

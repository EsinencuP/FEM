import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateHorseDto, CreateHorseOwnershipDto, HorseListQueryDto } from './horse.dto';

describe('Horse DTO validation', () => {
  const pipe = new ZodValidationPipe();

  const metadata = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
    type: 'body',
    metatype,
  });

  it('accepts a horse without FEI, passport or microchip identifiers', () => {
    expect(pipe.transform({ displayName: 'Demo Aurora' }, metadata(CreateHorseDto))).toEqual({
      displayName: 'Demo Aurora',
    });
  });

  it('rejects undeclared identifier and system fields', () => {
    expect(() =>
      pipe.transform(
        { displayName: 'Demo Aurora', feiId: 'not-allowed', createdAt: new Date() },
        metadata(CreateHorseDto),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects ownership whose end date is earlier than its start date', () => {
    expect(() =>
      pipe.transform(
        {
          ownerId: '00000000-0000-4000-8000-000000000001',
          startDate: '2026-07-23',
          endDate: '2026-07-22',
        },
        metadata(CreateHorseOwnershipDto),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a zero ownership share before it reaches PostgreSQL', () => {
    expect(() =>
      pipe.transform(
        {
          ownerId: '00000000-0000-4000-8000-000000000001',
          startDate: '2026-07-23',
          ownershipShare: 0,
        },
        metadata(CreateHorseOwnershipDto),
      ),
    ).toThrow(BadRequestException);
  });

  it('caps list pagination at 100', () => {
    expect(() => pipe.transform({ page: 1, limit: 101 }, metadata(HorseListQueryDto))).toThrow(
      BadRequestException,
    );
  });
});

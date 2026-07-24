import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';

import {
  CompetitionResultListQueryDto,
  CreateResultMetricDto,
} from '../../modules/competition-results/dto/competition-result.dto';
import { CompetitionListQueryDto } from '../../modules/competitions/dto/competition.dto';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe deterministic fuzz', () => {
  const pipe = new ZodValidationPipe();
  let state = 0x5eed1234;

  function next(): number {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  }

  function pick(values: unknown[]): unknown {
    return values[next() % values.length];
  }

  function metadata(metatype: ArgumentMetadata['metatype']): ArgumentMetadata {
    return { type: 'query', metatype };
  }

  it('never throws a non-validation exception for hostile list queries', () => {
    const scalars: unknown[] = [
      null,
      '',
      ' ',
      '-1',
      '0',
      '1',
      '100',
      '101',
      'NaN',
      'false',
      'TRUE',
      [],
      {},
      'x'.repeat(500),
      '00000000-0000-4000-8000-000000000001',
    ];

    for (let index = 0; index < 250; index += 1) {
      const input: Record<string, unknown> = {
        page: pick(scalars),
        limit: pick(scalars),
        sortBy: pick(scalars),
        sortOrder: pick(scalars),
        archived: pick(scalars),
        search: pick(scalars),
      };
      const dto = next() % 2 === 0 ? CompetitionListQueryDto : CompetitionResultListQueryDto;

      try {
        const parsed = z
          .object({ page: z.number(), limit: z.number() })
          .loose()
          .parse(pipe.transform(input, metadata(dto)));
        expect(parsed.page).toBeGreaterThanOrEqual(1);
        expect(parsed.limit).toBeGreaterThanOrEqual(1);
        expect(parsed.limit).toBeLessThanOrEqual(100);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    }
  });

  it('never accepts an empty metric value during deterministic mutation fuzz', () => {
    const invalidTextValues: unknown[] = ['', ' ', '   ', '\t', '\r\n'];

    for (let index = 0; index < 50; index += 1) {
      const input = {
        metricCode: `metric-${String(index)}`,
        textValue: pick(invalidTextValues),
      };

      expect(() => pipe.transform(input, metadata(CreateResultMetricDto))).toThrow(
        BadRequestException,
      );
    }
  });
});

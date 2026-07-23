import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateCompetitionDto } from '../../competitions/dto/competition.dto';
import { CreateCompetitionResultDto, CreateResultMetricDto } from './competition-result.dto';

describe('Competition and result DTO validation', () => {
  const pipe = new ZodValidationPipe();
  const metadata = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
    type: 'body',
    metatype,
  });

  it('rejects an event whose end date is earlier than its start date', () => {
    expect(() =>
      pipe.transform(
        {
          title: 'Demo Event',
          slug: 'demo-event',
          startDate: '2026-08-02',
          endDate: '2026-08-01',
        },
        metadata(CreateCompetitionDto),
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts a result with a status and without rank', () => {
    const input = {
      competitionClassId: '00000000-0000-4000-8000-000000000001',
      athleteId: '00000000-0000-4000-8000-000000000002',
      horseId: '00000000-0000-4000-8000-000000000003',
      statusId: '00000000-0000-4000-8000-000000000004',
    };
    expect(pipe.transform(input, metadata(CreateCompetitionResultDto))).toEqual(input);
  });

  it('rejects non-positive ranks and negative elapsed time', () => {
    expect(() =>
      pipe.transform(
        {
          competitionClassId: '00000000-0000-4000-8000-000000000001',
          athleteId: '00000000-0000-4000-8000-000000000002',
          horseId: '00000000-0000-4000-8000-000000000003',
          rank: 0,
          timeSeconds: -1,
        },
        metadata(CreateCompetitionResultDto),
      ),
    ).toThrow(BadRequestException);
  });

  it('requires exactly one metric value representation', () => {
    expect(() =>
      pipe.transform(
        { metricCode: 'score', numericValue: 10, textValue: 'ten' },
        metadata(CreateResultMetricDto),
      ),
    ).toThrow(BadRequestException);
  });
});

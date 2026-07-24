import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  CompetitionListQueryDto,
  CreateCompetitionDto,
  UpdateCompetitionDto,
} from '../../competitions/dto/competition.dto';
import {
  CompetitionResultListQueryDto,
  CreateCompetitionResultDto,
  CreateResultMetricDto,
  UpdateCompetitionResultDto,
} from './competition-result.dto';
import { CreateExternalIdentifierDto } from '../../external-identifiers/dto/external-identifier.dto';

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

  it('rejects a result without a direct outcome or metric', () => {
    expect(() =>
      pipe.transform(
        {
          competitionClassId: '00000000-0000-4000-8000-000000000001',
          athleteId: '00000000-0000-4000-8000-000000000002',
          horseId: '00000000-0000-4000-8000-000000000003',
        },
        metadata(CreateCompetitionResultDto),
      ),
    ).toThrow(BadRequestException);
  });

  it.each([
    [
      CreateCompetitionDto,
      {
        title: 'Demo Event',
        slug: 'demo-event',
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        publicationStatus: 'PUBLISHED',
      },
    ],
    [
      CreateCompetitionResultDto,
      {
        competitionClassId: '00000000-0000-4000-8000-000000000001',
        athleteId: '00000000-0000-4000-8000-000000000002',
        horseId: '00000000-0000-4000-8000-000000000003',
        statusId: '00000000-0000-4000-8000-000000000004',
        publicationStatus: 'PUBLISHED',
      },
    ],
    [UpdateCompetitionDto, { publicationStatus: 'PUBLISHED' }],
    [UpdateCompetitionResultDto, { publicationStatus: 'PUBLISHED' }],
  ])('rejects publication through generic mutation DTO %p', (dto, input) => {
    expect(() => pipe.transform(input, metadata(dto))).toThrow(BadRequestException);
  });

  it('parses canonical false query values as false', () => {
    expect(
      pipe.transform({ hasRank: 'false' }, metadata(CompetitionResultListQueryDto)),
    ).toMatchObject({ hasRank: false });
    expect(pipe.transform({ upcoming: 'false' }, metadata(CompetitionListQueryDto))).toMatchObject({
      upcoming: false,
    });
  });

  it.each(['0', '1', 'yes', 'FALSE', ''])('rejects an unsupported query boolean: %s', (value) => {
    expect(() =>
      pipe.transform({ hasRank: value }, metadata(CompetitionResultListQueryDto)),
    ).toThrow(BadRequestException);
  });

  it.each([
    ['verificationStatus', 'VERIFIED'],
    ['verifiedAt', '2026-07-23T10:00:00.000Z'],
    ['normalizationVersion', 'client-v2'],
    ['isPrimary', true],
  ])('rejects client-controlled identifier provenance field %s', (field, fieldValue) => {
    expect(() =>
      pipe.transform(
        {
          identifierType: 'FEI_ID',
          namespace: 'FEI',
          value: 'demo-value',
          [field]: fieldValue,
        },
        metadata(CreateExternalIdentifierDto),
      ),
    ).toThrow(BadRequestException);
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

  it.each(['', '   '])('rejects an empty text metric value: %p', (textValue) => {
    expect(() =>
      pipe.transform({ metricCode: 'comment', textValue }, metadata(CreateResultMetricDto)),
    ).toThrow(BadRequestException);
  });
});

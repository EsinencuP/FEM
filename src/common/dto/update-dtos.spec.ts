import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { UpdateAthleteDto } from '../../modules/athletes/dto/athlete.dto';
import { UpdateClubDto } from '../../modules/clubs/dto/club.dto';
import { UpdateCompetitionClassDto } from '../../modules/competition-classes/dto/competition-class.dto';
import {
  UpdateCompetitionResultDto,
  UpdateResultMetricDto,
} from '../../modules/competition-results/dto/competition-result.dto';
import { UpdateCompetitionDto } from '../../modules/competitions/dto/competition.dto';
import { UpdateCountryDto } from '../../modules/countries/dto/country.dto';
import { UpdateDisciplineDto } from '../../modules/disciplines/dto/discipline.dto';
import { UpdateExternalIdentifierDto } from '../../modules/external-identifiers/dto/external-identifier.dto';
import { UpdateHorseDto } from '../../modules/horses/dto/horse.dto';
import { UpdateOwnerDto } from '../../modules/owners/dto/owner.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

describe('update DTO contracts', () => {
  const pipe = new ZodValidationPipe();
  const metadata = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
    type: 'body',
    metatype,
  });

  it.each([
    ['country', UpdateCountryDto],
    ['discipline', UpdateDisciplineDto],
    ['club', UpdateClubDto],
    ['owner', UpdateOwnerDto],
    ['athlete', UpdateAthleteDto],
    ['horse', UpdateHorseDto],
    ['competition', UpdateCompetitionDto],
    ['competition class', UpdateCompetitionClassDto],
    ['competition result', UpdateCompetitionResultDto],
    ['result metric', UpdateResultMetricDto],
    ['external identifier', UpdateExternalIdentifierDto],
  ])('rejects an empty %s update', (_name, metatype) => {
    expect(() => pipe.transform({}, metadata(metatype))).toThrow(BadRequestException);
  });
});

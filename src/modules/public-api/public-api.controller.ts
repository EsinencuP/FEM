import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import {
  PublicAthleteListQueryDto,
  PublicClubListQueryDto,
  PublicCompetitionClassListQueryDto,
  PublicCompetitionListQueryDto,
  PublicCountryListQueryDto,
  PublicDisciplineListQueryDto,
  PublicHorseListQueryDto,
  PublicLocale,
  PublicResultListQueryDto,
} from './dto/public-api.dto';
import { PublicApiService } from './public-api.service';
import { PublicCacheInterceptor } from './public-cache.interceptor';

const uuid = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });
const locale = (): ParseEnumPipe => new ParseEnumPipe(PublicLocale);

@ApiTags('Public API')
@ApiStandardErrors()
@ApiParam({
  name: 'lang',
  enum: PublicLocale,
  description: 'Requested public route locale. Sports source fields are not machine-translated.',
})
@UseInterceptors(PublicCacheInterceptor)
@Controller('v1/public/:lang')
export class PublicApiController {
  constructor(private readonly service: PublicApiService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List non-demo, non-archived countries' })
  countriesList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicCountryListQueryDto,
  ): ReturnType<PublicApiService['countries']> {
    return this.service.countries(query);
  }

  @Get('disciplines')
  @ApiOperation({ summary: 'List publicly visible disciplines' })
  disciplinesList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicDisciplineListQueryDto,
  ): ReturnType<PublicApiService['disciplines']> {
    return this.service.disciplines(query);
  }

  @Get('clubs')
  @ApiOperation({ summary: 'List publicly visible clubs' })
  clubsList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicClubListQueryDto,
  ): ReturnType<PublicApiService['clubs']> {
    return this.service.clubs(query);
  }

  @Get('clubs/:id')
  @ApiOperation({ summary: 'Get a public club profile' })
  clubDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('id', uuid()) id: string,
  ): ReturnType<PublicApiService['club']> {
    return this.service.club(id);
  }

  @Get('athletes')
  @ApiOperation({ summary: 'List publicly visible athletes' })
  athletesList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicAthleteListQueryDto,
  ): ReturnType<PublicApiService['athletes']> {
    return this.service.athletes(query);
  }

  @Get('athletes/:id')
  @ApiOperation({ summary: 'Get a public athlete profile' })
  athleteDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('id', uuid()) id: string,
  ): ReturnType<PublicApiService['athlete']> {
    return this.service.athlete(id);
  }

  @Get('horses')
  @ApiOperation({ summary: 'List publicly visible horses' })
  horsesList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicHorseListQueryDto,
  ): ReturnType<PublicApiService['horses']> {
    return this.service.horses(query);
  }

  @Get('horses/:id')
  @ApiOperation({ summary: 'Get a public horse profile' })
  horseDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('id', uuid()) id: string,
  ): ReturnType<PublicApiService['horse']> {
    return this.service.horse(id);
  }

  @Get('competitions')
  @ApiOperation({ summary: 'List published competitions' })
  competitionsList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicCompetitionListQueryDto,
  ): ReturnType<PublicApiService['competitions']> {
    return this.service.competitions(query);
  }

  @Get('competitions/:slug')
  @ApiOperation({ summary: 'Get a published competition by stable slug' })
  competitionDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('slug') slug: string,
  ): ReturnType<PublicApiService['competition']> {
    return this.service.competition(slug);
  }

  @Get('competition-classes')
  @ApiOperation({ summary: 'List classes of published competitions' })
  competitionClassesList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicCompetitionClassListQueryDto,
  ): ReturnType<PublicApiService['competitionClasses']> {
    return this.service.competitionClasses(query);
  }

  @Get('competition-classes/:id')
  @ApiOperation({ summary: 'Get a class of a published competition' })
  competitionClassDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('id', uuid()) id: string,
  ): ReturnType<PublicApiService['competitionClass']> {
    return this.service.competitionClass(id);
  }

  @Get('results')
  @ApiOperation({ summary: 'List published competition results' })
  resultsList(
    @Param('lang', locale()) _lang: PublicLocale,
    @Query() query: PublicResultListQueryDto,
  ): ReturnType<PublicApiService['results']> {
    return this.service.results(query);
  }

  @Get('results/:id')
  @ApiOperation({ summary: 'Get one published competition result' })
  resultDetail(
    @Param('lang', locale()) _lang: PublicLocale,
    @Param('id', uuid()) id: string,
  ): ReturnType<PublicApiService['result']> {
    return this.service.result(id);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import {
  CreateExternalIdentifierDto,
  UpdateExternalIdentifierDto,
} from '../external-identifiers/dto/external-identifier.dto';
import { ExternalIdentifiersService } from '../external-identifiers/external-identifiers.service';
import {
  CreateHorseAthleteRelationDto,
  CreateHorseDto,
  CreateHorseOwnershipDto,
  HorseListQueryDto,
  UpdateHorseAthleteRelationDto,
  UpdateHorseDto,
  UpdateHorseOwnershipDto,
} from './dto/horse.dto';
import { HorsesService } from './horses.service';

const uuidPipe = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });

@ApiTags('Horses')
@ApiStandardErrors()
@Controller('v1/horses')
export class HorsesController {
  constructor(
    private readonly service: HorsesService,
    private readonly identifiers: ExternalIdentifiersService,
  ) {}

  @Get()
  list(@Query() query: HorseListQueryDto): ReturnType<HorsesService['list']> {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', uuidPipe()) id: string): ReturnType<HorsesService['get']> {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateHorseDto): ReturnType<HorsesService['create']> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: UpdateHorseDto,
  ): ReturnType<HorsesService['update']> {
    return this.service.update(id, dto);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a horse without deleting results' })
  archive(@Param('id', uuidPipe()) id: string): ReturnType<HorsesService['archive']> {
    return this.service.archive(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', uuidPipe()) id: string): ReturnType<HorsesService['restore']> {
    return this.service.restore(id);
  }

  @Get(':id/owners')
  owners(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<HorsesService['owners']> {
    return this.service.owners(id, query);
  }

  @Post(':id/owners')
  addOwner(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: CreateHorseOwnershipDto,
  ): ReturnType<HorsesService['addOwner']> {
    return this.service.addOwner(id, dto);
  }

  @Patch(':id/owners/:ownershipId')
  updateOwner(
    @Param('id', uuidPipe()) id: string,
    @Param('ownershipId', uuidPipe()) ownershipId: string,
    @Body() dto: UpdateHorseOwnershipDto,
  ): ReturnType<HorsesService['updateOwner']> {
    return this.service.updateOwner(id, ownershipId, dto);
  }

  @Get(':id/athletes')
  athletes(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<HorsesService['athletes']> {
    return this.service.athletes(id, query);
  }

  @Post(':id/athletes')
  addAthlete(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: CreateHorseAthleteRelationDto,
  ): ReturnType<HorsesService['addAthlete']> {
    return this.service.addAthlete(id, dto);
  }

  @Patch(':id/athletes/:relationId')
  updateAthlete(
    @Param('id', uuidPipe()) id: string,
    @Param('relationId', uuidPipe()) relationId: string,
    @Body() dto: UpdateHorseAthleteRelationDto,
  ): ReturnType<HorsesService['updateAthlete']> {
    return this.service.updateAthlete(id, relationId, dto);
  }

  @Get(':id/results')
  results(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<HorsesService['results']> {
    return this.service.results(id, query);
  }

  @Get(':id/identifiers')
  identifierList(
    @Param('id', uuidPipe()) id: string,
  ): ReturnType<ExternalIdentifiersService['list']> {
    return this.identifiers.list('Horse', id);
  }

  @Post(':id/identifiers')
  identifierCreate(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: CreateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['create']> {
    return this.identifiers.create('Horse', id, dto);
  }

  @Patch(':id/identifiers/:identifierId')
  identifierUpdate(
    @Param('id', uuidPipe()) id: string,
    @Param('identifierId', uuidPipe()) identifierId: string,
    @Body() dto: UpdateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['update']> {
    return this.identifiers.update('Horse', id, identifierId, dto);
  }
}

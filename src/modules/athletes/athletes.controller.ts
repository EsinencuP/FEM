import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import {
  CreateExternalIdentifierDto,
  UpdateExternalIdentifierDto,
} from '../external-identifiers/dto/external-identifier.dto';
import { ExternalIdentifiersService } from '../external-identifiers/external-identifiers.service';
import { AthletesService } from './athletes.service';
import {
  AthleteListQueryDto,
  CreateAthleteClubMembershipDto,
  CreateAthleteDto,
  CreateAthleteHorseRelationDto,
  UpdateAthleteClubMembershipDto,
  UpdateAthleteDto,
  UpdateAthleteHorseRelationDto,
} from './dto/athlete.dto';
const u = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });
@ApiTags('Athletes')
@ApiStandardErrors()
@AdminProtected()
@Controller('v1/admin/athletes')
export class AthletesController {
  constructor(
    private readonly s: AthletesService,
    private readonly identifiers: ExternalIdentifiersService,
  ) {}
  @Get() list(@Query() q: AthleteListQueryDto): ReturnType<AthletesService['list']> {
    return this.s.list(q);
  }
  @Get(':id') get(@Param('id', u()) id: string): ReturnType<AthletesService['get']> {
    return this.s.get(id);
  }
  @Post() create(@Body() d: CreateAthleteDto): ReturnType<AthletesService['create']> {
    return this.s.create(d);
  }
  @Patch(':id') update(
    @Param('id', u()) id: string,
    @Body() d: UpdateAthleteDto,
  ): ReturnType<AthletesService['update']> {
    return this.s.update(id, d);
  }
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive athlete without deleting results' })
  archive(@Param('id', u()) id: string): ReturnType<AthletesService['archive']> {
    return this.s.archive(id);
  }
  @Patch(':id/restore') restore(
    @Param('id', u()) id: string,
  ): ReturnType<AthletesService['restore']> {
    return this.s.restore(id);
  }
  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a validated athlete profile for the Public API' })
  publish(@Param('id', u()) id: string): ReturnType<AthletesService['publish']> {
    return this.s.publish(id);
  }
  @Patch(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw an athlete profile from the Public API' })
  withdraw(@Param('id', u()) id: string): ReturnType<AthletesService['withdraw']> {
    return this.s.withdraw(id);
  }
  @Get(':id/clubs') clubs(
    @Param('id', u()) id: string,
    @Query() q: PaginationQueryDto,
  ): ReturnType<AthletesService['clubs']> {
    return this.s.clubs(id, q);
  }
  @Post(':id/clubs') addClub(
    @Param('id', u()) id: string,
    @Body() d: CreateAthleteClubMembershipDto,
  ): ReturnType<AthletesService['addClub']> {
    return this.s.addClub(id, d);
  }
  @Patch(':id/clubs/:membershipId') updateClub(
    @Param('id', u()) id: string,
    @Param('membershipId', u()) mid: string,
    @Body() d: UpdateAthleteClubMembershipDto,
  ): ReturnType<AthletesService['updateClub']> {
    return this.s.updateClub(id, mid, d);
  }
  @Get(':id/horses') horses(
    @Param('id', u()) id: string,
    @Query() q: PaginationQueryDto,
  ): ReturnType<AthletesService['horses']> {
    return this.s.horses(id, q);
  }
  @Post(':id/horses') addHorse(
    @Param('id', u()) id: string,
    @Body() d: CreateAthleteHorseRelationDto,
  ): ReturnType<AthletesService['addHorse']> {
    return this.s.addHorse(id, d);
  }
  @Patch(':id/horses/:relationId') updateHorse(
    @Param('id', u()) id: string,
    @Param('relationId', u()) rid: string,
    @Body() d: UpdateAthleteHorseRelationDto,
  ): ReturnType<AthletesService['updateHorse']> {
    return this.s.updateHorse(id, rid, d);
  }
  @Get(':id/results') results(
    @Param('id', u()) id: string,
    @Query() q: PaginationQueryDto,
  ): ReturnType<AthletesService['results']> {
    return this.s.results(id, q);
  }
  @Get(':id/identifiers') identifierList(
    @Param('id', u()) id: string,
    @Query() q: PaginationQueryDto,
  ): ReturnType<ExternalIdentifiersService['list']> {
    return this.identifiers.list('Athlete', id, q);
  }
  @Post(':id/identifiers') identifierCreate(
    @Param('id', u()) id: string,
    @Body() d: CreateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['create']> {
    return this.identifiers.create('Athlete', id, d);
  }
  @Patch(':id/identifiers/:identifierId') identifierUpdate(
    @Param('id', u()) id: string,
    @Param('identifierId', u()) iid: string,
    @Body() d: UpdateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['update']> {
    return this.identifiers.update('Athlete', id, iid, d);
  }
}

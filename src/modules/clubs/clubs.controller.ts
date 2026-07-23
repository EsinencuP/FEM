import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import {
  CreateExternalIdentifierDto,
  UpdateExternalIdentifierDto,
} from '../external-identifiers/dto/external-identifier.dto';
import { ExternalIdentifiersService } from '../external-identifiers/external-identifiers.service';
import { ClubsService } from './clubs.service';
import { ClubListQueryDto, CreateClubDto, UpdateClubDto } from './dto/club.dto';
const uuidPipe = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });
@ApiTags('Clubs')
@ApiStandardErrors()
@Controller('v1/clubs')
export class ClubsController {
  constructor(
    private readonly service: ClubsService,
    private readonly identifiers: ExternalIdentifiersService,
  ) {}
  @Get() list(@Query() q: ClubListQueryDto): ReturnType<ClubsService['list']> {
    return this.service.list(q);
  }
  @Get(':id') get(@Param('id', uuidPipe()) id: string): ReturnType<ClubsService['get']> {
    return this.service.get(id);
  }
  @Post() create(@Body() dto: CreateClubDto): ReturnType<ClubsService['create']> {
    return this.service.create(dto);
  }
  @Patch(':id') update(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: UpdateClubDto,
  ): ReturnType<ClubsService['update']> {
    return this.service.update(id, dto);
  }
  @Patch(':id/archive') @ApiOperation({ summary: 'Archive a club' }) archive(
    @Param('id', uuidPipe()) id: string,
  ): ReturnType<ClubsService['archive']> {
    return this.service.archive(id);
  }
  @Patch(':id/restore') restore(
    @Param('id', uuidPipe()) id: string,
  ): ReturnType<ClubsService['restore']> {
    return this.service.restore(id);
  }
  @Get(':id/identifiers') identifiersList(
    @Param('id', uuidPipe()) id: string,
  ): ReturnType<ExternalIdentifiersService['list']> {
    return this.identifiers.list('Club', id);
  }
  @Post(':id/identifiers') identifiersCreate(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: CreateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['create']> {
    return this.identifiers.create('Club', id, dto);
  }
  @Patch(':id/identifiers/:identifierId') identifiersUpdate(
    @Param('id', uuidPipe()) id: string,
    @Param('identifierId', uuidPipe()) identifierId: string,
    @Body() dto: UpdateExternalIdentifierDto,
  ): ReturnType<ExternalIdentifiersService['update']> {
    return this.identifiers.update('Club', id, identifierId, dto);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import {
  CompetitionListQueryDto,
  CreateCompetitionDto,
  UpdateCompetitionDto,
} from './dto/competition.dto';
import { CompetitionsService } from './competitions.service';

const uuidPipe = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });

@ApiTags('Competitions')
@ApiStandardErrors()
@AdminProtected()
@Controller('v1/admin/competitions')
export class CompetitionsController {
  constructor(private readonly service: CompetitionsService) {}
  @Get() list(@Query() query: CompetitionListQueryDto): ReturnType<CompetitionsService['list']> {
    return this.service.list(query);
  }
  @Get('by-slug/:slug')
  getBySlug(@Param('slug') slug: string): ReturnType<CompetitionsService['getBySlug']> {
    return this.service.getBySlug(slug);
  }
  @Get(':id') get(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionsService['get']> {
    return this.service.get(id);
  }
  @Post() create(@Body() dto: CreateCompetitionDto): ReturnType<CompetitionsService['create']> {
    return this.service.create(dto);
  }
  @Patch(':id')
  update(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: UpdateCompetitionDto,
  ): ReturnType<CompetitionsService['update']> {
    return this.service.update(id, dto);
  }
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive an event without deleting classes or results' })
  archive(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionsService['archive']> {
    return this.service.archive(id);
  }
  @Patch(':id/restore')
  restore(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionsService['restore']> {
    return this.service.restore(id);
  }
  @Get(':id/classes')
  classes(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<CompetitionsService['classes']> {
    return this.service.classes(id, query);
  }
  @Get(':id/results')
  results(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<CompetitionsService['results']> {
    return this.service.results(id, query);
  }
}

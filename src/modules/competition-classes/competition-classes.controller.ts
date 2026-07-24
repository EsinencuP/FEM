import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { CompetitionClassesService } from './competition-classes.service';
import {
  CompetitionClassListQueryDto,
  CreateCompetitionClassDto,
  UpdateCompetitionClassDto,
} from './dto/competition-class.dto';

const uuidPipe = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });

@ApiTags('Competition Classes')
@ApiStandardErrors()
@AdminProtected()
@Controller('v1/admin/competition-classes')
export class CompetitionClassesController {
  constructor(private readonly service: CompetitionClassesService) {}
  @Get() list(
    @Query() query: CompetitionClassListQueryDto,
  ): ReturnType<CompetitionClassesService['list']> {
    return this.service.list(query);
  }
  @Get(':id')
  get(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionClassesService['get']> {
    return this.service.get(id);
  }
  @Post()
  create(@Body() dto: CreateCompetitionClassDto): ReturnType<CompetitionClassesService['create']> {
    return this.service.create(dto);
  }
  @Patch(':id')
  update(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: UpdateCompetitionClassDto,
  ): ReturnType<CompetitionClassesService['update']> {
    return this.service.update(id, dto);
  }
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a class without deleting results' })
  archive(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionClassesService['archive']> {
    return this.service.archive(id);
  }
  @Patch(':id/restore')
  restore(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionClassesService['restore']> {
    return this.service.restore(id);
  }
  @Get(':id/results')
  results(
    @Param('id', uuidPipe()) id: string,
    @Query() query: PaginationQueryDto,
  ): ReturnType<CompetitionClassesService['results']> {
    return this.service.results(id, query);
  }
}

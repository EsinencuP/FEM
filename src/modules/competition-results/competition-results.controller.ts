import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { CompetitionResultsService } from './competition-results.service';
import {
  CompetitionResultListQueryDto,
  CreateCompetitionResultDto,
  CreateResultMetricDto,
  UpdateCompetitionResultDto,
  UpdateResultMetricDto,
} from './dto/competition-result.dto';

const uuidPipe = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });

@ApiTags('Results')
@ApiStandardErrors()
@AdminProtected()
@Controller('v1/admin/results')
export class CompetitionResultsController {
  constructor(private readonly service: CompetitionResultsService) {}
  @Get() list(
    @Query() query: CompetitionResultListQueryDto,
  ): ReturnType<CompetitionResultsService['list']> {
    return this.service.list(query);
  }
  @Get(':id')
  get(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionResultsService['get']> {
    return this.service.get(id);
  }
  @Post()
  create(@Body() dto: CreateCompetitionResultDto): ReturnType<CompetitionResultsService['create']> {
    return this.service.create(dto);
  }
  @Patch(':id')
  update(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: UpdateCompetitionResultDto,
  ): ReturnType<CompetitionResultsService['update']> {
    return this.service.update(id, dto);
  }
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a result without physical deletion' })
  archive(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionResultsService['archive']> {
    return this.service.archive(id);
  }
  @Patch(':id/restore')
  restore(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionResultsService['restore']> {
    return this.service.restore(id);
  }
  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a validated result for the Public API' })
  publish(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionResultsService['publish']> {
    return this.service.publish(id);
  }
  @Patch(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw a result from the Public API' })
  withdraw(@Param('id', uuidPipe()) id: string): ReturnType<CompetitionResultsService['withdraw']> {
    return this.service.withdraw(id);
  }
  @Post(':id/metrics')
  addMetric(
    @Param('id', uuidPipe()) id: string,
    @Body() dto: CreateResultMetricDto,
  ): ReturnType<CompetitionResultsService['addMetric']> {
    return this.service.addMetric(id, dto);
  }
  @Patch(':id/metrics/:metricId')
  updateMetric(
    @Param('id', uuidPipe()) id: string,
    @Param('metricId', uuidPipe()) metricId: string,
    @Body() dto: UpdateResultMetricDto,
  ): ReturnType<CompetitionResultsService['updateMetric']> {
    return this.service.updateMetric(id, metricId, dto);
  }
  @Delete(':id/metrics/:metricId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMetric(
    @Param('id', uuidPipe()) id: string,
    @Param('metricId', uuidPipe()) metricId: string,
  ): ReturnType<CompetitionResultsService['deleteMetric']> {
    return this.service.deleteMetric(id, metricId);
  }
}

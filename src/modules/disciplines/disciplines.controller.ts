import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { DisciplinesService } from './disciplines.service';
import {
  CreateDisciplineDto,
  DisciplineListQueryDto,
  UpdateDisciplineDto,
} from './dto/discipline.dto';

@ApiTags('Disciplines')
@ApiStandardErrors()
@AdminProtected()
@Controller('v1/admin/disciplines')
export class DisciplinesController {
  constructor(private readonly service: DisciplinesService) {}
  @Get() @ApiOperation({ summary: 'List disciplines with pagination' }) list(
    @Query() q: DisciplineListQueryDto,
  ): ReturnType<DisciplinesService['list']> {
    return this.service.list(q);
  }
  @Get(':id') @ApiOperation({ summary: 'Get a discipline' }) get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<DisciplinesService['get']> {
    return this.service.get(id);
  }
  @Post() @ApiCreatedResponse({ description: 'Discipline created' }) create(
    @Body() dto: CreateDisciplineDto,
  ): ReturnType<DisciplinesService['create']> {
    return this.service.create(dto);
  }
  @Patch(':id') update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDisciplineDto,
  ): ReturnType<DisciplinesService['update']> {
    return this.service.update(id, dto);
  }
  @Patch(':id/archive') @ApiOperation({ summary: 'Archive a discipline' }) archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<DisciplinesService['archive']> {
    return this.service.archive(id);
  }
  @Patch(':id/restore') @ApiOperation({ summary: 'Restore a discipline' }) restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<DisciplinesService['restore']> {
    return this.service.restore(id);
  }
}

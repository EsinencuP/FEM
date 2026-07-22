import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { DisciplinesService } from './disciplines.service';
import { CreateDisciplineDto, DisciplineListQueryDto, UpdateDisciplineDto } from './dto/discipline.dto';

@ApiTags('Disciplines') @ApiStandardErrors() @Controller('v1/disciplines')
export class DisciplinesController {
  constructor(private readonly service:DisciplinesService) {}
  @Get() @ApiOperation({summary:'List disciplines with pagination'}) list(@Query() q:DisciplineListQueryDto){return this.service.list(q);}
  @Get(':id') @ApiOperation({summary:'Get a discipline'}) get(@Param('id',new ParseUUIDPipe({version:'4'})) id:string){return this.service.get(id);}
  @Post() @ApiCreatedResponse({description:'Discipline created'}) create(@Body() dto:CreateDisciplineDto){return this.service.create(dto);}
  @Patch(':id') update(@Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() dto:UpdateDisciplineDto){return this.service.update(id,dto);}
  @Patch(':id/archive') @ApiOperation({summary:'Archive a discipline'}) archive(@Param('id',new ParseUUIDPipe({version:'4'})) id:string){return this.service.archive(id);}
  @Patch(':id/restore') @ApiOperation({summary:'Restore a discipline'}) restore(@Param('id',new ParseUUIDPipe({version:'4'})) id:string){return this.service.restore(id);}
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { CreateOwnerDto, OwnerListQueryDto, UpdateOwnerDto } from './dto/owner.dto';
import { OwnersService } from './owners.service';
const up = (): ParseUUIDPipe => new ParseUUIDPipe({ version: '4' as const });
@ApiTags('Owners')
@ApiStandardErrors()
@Controller('v1/owners')
export class OwnersController {
  constructor(private readonly s: OwnersService) {}
  @Get() list(@Query() q: OwnerListQueryDto): ReturnType<OwnersService['list']> {
    return this.s.list(q);
  }
  @Get(':id') get(@Param('id', up()) id: string): ReturnType<OwnersService['get']> {
    return this.s.get(id);
  }
  @Post() create(@Body() d: CreateOwnerDto): ReturnType<OwnersService['create']> {
    return this.s.create(d);
  }
  @Patch(':id') update(
    @Param('id', up()) id: string,
    @Body() d: UpdateOwnerDto,
  ): ReturnType<OwnersService['update']> {
    return this.s.update(id, d);
  }
  @Patch(':id/archive') archive(
    @Param('id', up()) id: string,
  ): ReturnType<OwnersService['archive']> {
    return this.s.archive(id);
  }
  @Patch(':id/restore') restore(
    @Param('id', up()) id: string,
  ): ReturnType<OwnersService['restore']> {
    return this.s.restore(id);
  }
}

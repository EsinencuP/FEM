import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { CountriesService } from './countries.service';
import { CountryListQueryDto, CreateCountryDto, UpdateCountryDto } from './dto/country.dto';

@ApiTags('Countries')
@ApiStandardErrors()
@Controller('v1/countries')
export class CountriesController {
  constructor(private readonly service: CountriesService) {}

  @Get()
  @ApiOperation({ summary: 'List countries with pagination' })
  @ApiOkResponse({ description: 'Paginated country list' })
  list(@Query() query: CountryListQueryDto): ReturnType<CountriesService['list']> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a country' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<CountriesService['get']> {
    return this.service.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a country' })
  @ApiCreatedResponse({ description: 'Country created' })
  create(@Body() dto: CreateCountryDto): ReturnType<CountriesService['create']> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a country' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCountryDto,
  ): ReturnType<CountriesService['update']> {
    return this.service.update(id, dto);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a country without physical deletion' })
  archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<CountriesService['archive']> {
    return this.service.archive(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived country' })
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<CountriesService['restore']> {
    return this.service.restore(id);
  }
}

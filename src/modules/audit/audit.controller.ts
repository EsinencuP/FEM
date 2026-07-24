import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminProtected } from '../../common/decorators/admin-protected.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-contract.decorator';
import { AuditService } from './audit.service';
import { AuditLogListQueryDto } from './dto/audit.dto';

@ApiTags('Audit')
@ApiStandardErrors()
@AdminProtected()
@RequirePermissions('AUDIT_READ')
@Controller('v1/admin/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List immutable administrator and security audit events' })
  @ApiOkResponse({ description: 'Paginated audit event list' })
  list(@Query() query: AuditLogListQueryDto): ReturnType<AuditService['list']> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one immutable audit event' })
  @ApiOkResponse({ description: 'Audit event' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AuditService['get']> {
    return this.service.get(id);
  }
}

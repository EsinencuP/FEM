import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDetailDto {
  @ApiProperty({ example: 'displayName' })
  path!: string;

  @ApiProperty({ example: 'String must contain at least 1 character(s)' })
  message!: string;

  @ApiProperty({ example: 'too_small' })
  code!: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ type: [ApiErrorDetailDto] })
  details!: ApiErrorDetailDto[];

  @ApiProperty({ example: '2026-07-22T20:00:00.000Z', format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/athletes' })
  path!: string;

  @ApiProperty({ example: '8f332177-5b36-4ec5-a691-df9bb4b2c9ec' })
  requestId!: string;
}

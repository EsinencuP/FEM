import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ example: 'connected', enum: ['connected'] })
  database!: 'connected';

  @ApiProperty({ example: '2026-07-22T19:00:00.000Z', format: 'date-time' })
  timestamp!: string;
}

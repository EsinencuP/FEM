import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

class ExampleDto {
  static readonly schema = z.object({ name: z.string().min(1) });
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();
  const metadata: ArgumentMetadata = { type: 'body', metatype: ExampleDto };

  it('returns parsed DTO data', () => {
    expect(pipe.transform({ name: 'FEM' }, metadata)).toEqual({ name: 'FEM' });
  });

  it('rejects invalid DTO data', () => {
    expect(() => pipe.transform({ name: '' }, metadata)).toThrow(BadRequestException);
  });
});

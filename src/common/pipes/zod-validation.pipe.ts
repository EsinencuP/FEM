import { BadRequestException, Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

interface ZodSchemaCarrier {
  schema?: z.ZodType<unknown>;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype as ZodSchemaCarrier | undefined;
    const schema = metatype?.schema;

    if (!schema) {
      return value;
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request validation failed',
        issues: z.treeifyError(result.error),
      });
    }

    return result.data;
  }
}

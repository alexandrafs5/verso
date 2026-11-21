import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a value against a Zod schema and returns the parsed result.
 * Throws a ZodError on failure; ProblemJsonFilter turns it into a 400 VALIDATION_ERROR.
 * Use per parameter: `@Body(new ZodValidationPipe(schema)) body: Dto`.
 */
@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

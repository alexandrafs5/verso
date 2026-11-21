import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode, type Problem } from '@verso/shared';
import type { Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = this.toProblem(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof ZodError) {
      return {
        ...this.base(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR),
        errors: exception.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(exception.message, exception.stack);
        return this.base(status, ErrorCode.INTERNAL_ERROR);
      }
      return {
        ...this.base(status, this.codeFor(status)),
        detail: exception.message,
      };
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown exception',
      exception instanceof Error ? exception.stack : undefined,
    );
    return this.base(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
  }

  private codeFor(status: number): ErrorCode {
    if (status === HttpStatus.NOT_FOUND) return ErrorCode.NOT_FOUND;
    if (status === HttpStatus.BAD_REQUEST) return ErrorCode.VALIDATION_ERROR;
    return ErrorCode.INTERNAL_ERROR;
  }

  private base(status: number, code: ErrorCode): Problem {
    return {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      code,
    };
  }
}

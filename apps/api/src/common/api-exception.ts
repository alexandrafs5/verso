import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@verso/shared';

/** An HTTP error with a stable problem+json `code` (e.g. USERNAME_TAKEN). */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly detail?: string,
  ) {
    super(detail ?? code, status);
  }
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string): ApiHttpError {
  return new ApiHttpError(400, 'validation_error', message);
}

export function notFound(message = 'Resource not found.'): ApiHttpError {
  return new ApiHttpError(404, 'not_found', message);
}

export function methodNotAllowed(message = 'Method not allowed for this route.'): ApiHttpError {
  return new ApiHttpError(405, 'method_not_allowed', message);
}

export function conflict(code: string, message: string): ApiHttpError {
  return new ApiHttpError(409, code, message);
}

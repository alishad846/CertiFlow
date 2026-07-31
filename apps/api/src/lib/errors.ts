export class AppError extends Error {
  statusCode: number;
  /** Optional machine-readable code so clients can branch on the failure (e.g. 'account_not_found'). */
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (message = 'Resource not found') => new AppError(message, 404);

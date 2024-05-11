export class HSWSError extends Error {
  constructor(message: string, exception?: unknown) {
    super(message);

    Error.captureStackTrace(this, this.constructor);

    this.name = HSWSError.name;

    if (typeof exception !== 'undefined') {
      this.cause =
        exception instanceof Error ? `${exception.name}: ${exception.message}` : exception;
    }
  }
}

export class HSWSError extends Error {
  constructor(message: string, exception?: unknown) {
    super(message);

    Error.captureStackTrace(this, this.constructor);

    this.name = HSWSError.name;

    if (typeof exception !== 'undefined') {
      if (exception instanceof Error) {
        this.cause = `${exception.name}: ${exception.message}`;
        this.stack = exception.stack;
      } else {
        this.cause = exception;
      }
    }
  }
}

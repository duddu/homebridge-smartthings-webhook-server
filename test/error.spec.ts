import { describe, expect, jest, test } from '@jest/globals';

import { HSWSError } from '../src/error';

const captureStackTraceSpy = jest.spyOn(Error, 'captureStackTrace');

describe(HSWSError.name, () => {
  test('should set error message', () => {
    const error = new HSWSError('testMessage');

    expect(error).toHaveProperty('message', 'testMessage');
  });

  test('should set error name', () => {
    const error = new HSWSError('');

    expect(error).toHaveProperty('name', HSWSError.name);
  });

  test('should capture error stack trace', () => {
    const error = new HSWSError('');

    expect(captureStackTraceSpy).toHaveBeenCalledTimes(1);
    expect(captureStackTraceSpy).toHaveBeenCalledWith(error, HSWSError);
  });

  describe('if exception argument is an error instance', () => {
    test('should set error cause', () => {
      const error = new HSWSError('', new TypeError('testTypeErrorMessage'));

      expect(error).toHaveProperty('cause', 'TypeError: testTypeErrorMessage');
    });

    test('should set error stack', () => {
      const nestedException = new Error('');
      const error = new HSWSError('', nestedException);

      expect(error).toHaveProperty('stack', nestedException.stack);
    });
  });

  describe('if exception argument is not an error instance', () => {
    test('should set error cause', () => {
      const testPayload = { key: 'value' };
      const error = new HSWSError('', testPayload);

      expect(error).toHaveProperty('cause', testPayload);
    });
  });
});

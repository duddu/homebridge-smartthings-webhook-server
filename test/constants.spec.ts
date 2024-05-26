import { afterEach, describe, expect, test } from '@jest/globals';

import { constants, HSWSRequiredConstants, HSWSOptionalConstants } from '../src/constants';
import { HSWSError } from '../src/error';

describe(constants.constructor.name, () => {
  test('should be frozen object', () => {
    expect(Object.isFrozen(constants)).toBe(true);
  });

  test('should not have public properties', () => {
    expect(Object.keys(constants)).toHaveLength(0);
  });

  describe.each(Object.keys(HSWSRequiredConstants))('%s', (key) => {
    const backupEnv = process.env;

    afterEach(() => {
      process.env = backupEnv;
    });

    test('if environment variable not set should throw', () => {
      expect(() => constants[key]).toThrowError(HSWSError);
    });

    test('if environment variable not set should return it', () => {
      process.env[key] = `test_${key}`;

      expect(() => constants[key]).not.toThrowError(HSWSError);
      expect(constants[key]).toBe(`test_${key}`);
    });
  });

  describe.each(Object.keys(HSWSOptionalConstants))('%s', (key) => {
    const backupEnv = process.env;

    afterEach(() => {
      process.env = backupEnv;
    });

    test('if environment variable not set should return undefined', () => {
      expect(() => constants[key]).not.toThrowError(HSWSError);
      expect(constants[key]).toBeUndefined();
    });

    test('if environment variable not set should return it', () => {
      process.env[key] = `test_${key}`;

      expect(() => constants[key]).not.toThrowError(HSWSError);
      expect(constants[key]).toBe(`test_${key}`);
    });
  });
});

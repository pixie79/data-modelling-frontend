/**
 * Unit tests for Validation Utilities
 * Tests validation helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUUID,
  isNonEmptyString,
  isPositiveNumber,
  isValidTableName,
  isValidColumnName,
  sanitizeString,
} from '@/utils/validation';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString('  test  ')).toBe(true);
    });

    it('should reject empty strings and non-strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(null as any)).toBe(false);
      expect(isNonEmptyString(undefined as any)).toBe(false);
      expect(isNonEmptyString(123 as any)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should validate positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(100.5)).toBe(true);
    });

    it('should reject non-positive numbers and non-numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('123' as any)).toBe(false);
    });
  });

  describe('isValidTableName', () => {
    it('should validate correct table names', () => {
      expect(isValidTableName('users')).toBe(true);
      expect(isValidTableName('user_profiles')).toBe(true);
      expect(isValidTableName('Table123')).toBe(true);
    });

    it('should reject invalid table names', () => {
      expect(isValidTableName('')).toBe(false);
      expect(isValidTableName('table-name')).toBe(false); // Hyphens not allowed
      expect(isValidTableName('table name')).toBe(false); // Spaces not allowed
      expect(isValidTableName('a'.repeat(256))).toBe(false); // Too long
    });
  });

  describe('isValidColumnName', () => {
    it('should validate correct column names', () => {
      expect(isValidColumnName('id')).toBe(true);
      expect(isValidColumnName('user_id')).toBe(true);
      expect(isValidColumnName('Column123')).toBe(true);
    });

    it('should reject invalid column names', () => {
      expect(isValidColumnName('')).toBe(false);
      expect(isValidColumnName('column-name')).toBe(false);
      expect(isValidColumnName('column name')).toBe(false);
      expect(isValidColumnName('a'.repeat(256))).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('test<script>')).toBe('testscript');
      expect(sanitizeString('test"value"')).toBe('testvalue');
      expect(sanitizeString("test'value'")).toBe('testvalue');
      expect(sanitizeString('test<tag>')).toBe('testtag');
    });

    it('should preserve safe characters', () => {
      expect(sanitizeString('test_value123')).toBe('test_value123');
      expect(sanitizeString('Test Value')).toBe('Test Value');
    });
  });
});


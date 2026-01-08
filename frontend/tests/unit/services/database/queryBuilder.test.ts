/**
 * Unit tests for Query Builder
 * Tests the type-safe SQL query builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  query,
  QueryBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
} from '@/services/database/queryBuilder';

// Mock DuckDB service
vi.mock('@/services/database/duckdbService', () => ({
  getDuckDBService: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ success: true, rows: [] }),
    execute: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe('QueryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SELECT queries', () => {
    it('should build a simple SELECT query', () => {
      const { sql, params } = query.select('users').select('id', 'name').build();

      expect(sql).toBe('SELECT id, name FROM users');
      expect(params).toEqual([]);
    });

    it('should build SELECT * query', () => {
      const { sql } = query.select('users').build();

      expect(sql).toBe('SELECT * FROM users');
    });

    it('should build SELECT with WHERE clause', () => {
      const { sql, params } = query
        .select('users')
        .select('id', 'name')
        .where('id', '=', 1)
        .build();

      expect(sql).toBe('SELECT id, name FROM users WHERE id = ?');
      expect(params).toEqual([1]);
    });

    it('should build SELECT with multiple WHERE conditions', () => {
      const { sql, params } = query
        .select('users')
        .where('status', '=', 'active')
        .andWhere('age', '>', 18)
        .build();

      expect(sql).toBe('SELECT * FROM users WHERE status = ? AND age > ?');
      expect(params).toEqual(['active', 18]);
    });

    it('should build SELECT with OR WHERE', () => {
      const { sql, params } = query
        .select('users')
        .where('role', '=', 'admin')
        .orWhere('role', '=', 'superuser')
        .build();

      expect(sql).toBe('SELECT * FROM users WHERE role = ? OR role = ?');
      expect(params).toEqual(['admin', 'superuser']);
    });

    it('should build SELECT with ORDER BY', () => {
      const { sql } = query.select('users').orderBy('created_at', 'DESC').build();

      expect(sql).toBe('SELECT * FROM users ORDER BY created_at DESC');
    });

    it('should build SELECT with multiple ORDER BY', () => {
      const { sql } = query
        .select('users')
        .orderBy('last_name', 'ASC')
        .orderBy('first_name', 'ASC')
        .build();

      expect(sql).toBe('SELECT * FROM users ORDER BY last_name ASC, first_name ASC');
    });

    it('should build SELECT with LIMIT', () => {
      const { sql } = query.select('users').limit(10).build();

      expect(sql).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should build SELECT with LIMIT and OFFSET', () => {
      const { sql } = query.select('users').limit(10).offset(20).build();

      expect(sql).toBe('SELECT * FROM users LIMIT 10 OFFSET 20');
    });

    it('should build SELECT with JOIN', () => {
      const { sql } = query
        .select('orders')
        .select('orders.id', 'users.name')
        .innerJoin('users', 'orders.user_id = users.id')
        .build();

      expect(sql).toBe(
        'SELECT orders.id, users.name FROM orders INNER JOIN users ON orders.user_id = users.id'
      );
    });

    it('should build SELECT with LEFT JOIN', () => {
      const { sql } = query.select('orders').leftJoin('users', 'orders.user_id = users.id').build();

      expect(sql).toBe('SELECT * FROM orders LEFT JOIN users ON orders.user_id = users.id');
    });

    it('should build SELECT with GROUP BY', () => {
      const { sql } = query
        .select('orders')
        .select('user_id', 'COUNT(*) as order_count')
        .groupBy('user_id')
        .build();

      expect(sql).toBe('SELECT user_id, COUNT(*) as order_count FROM orders GROUP BY user_id');
    });

    it('should build SELECT with HAVING', () => {
      const { sql, params } = query
        .select('orders')
        .select('user_id', 'COUNT(*) as cnt')
        .groupBy('user_id')
        .having('COUNT(*)', '>', 5)
        .build();

      expect(sql).toBe(
        'SELECT user_id, COUNT(*) as cnt FROM orders GROUP BY user_id HAVING COUNT(*) > ?'
      );
      expect(params).toEqual([5]);
    });

    it('should build SELECT with DISTINCT', () => {
      const { sql } = query.select('users').distinct().select('email').build();

      expect(sql).toBe('SELECT DISTINCT email FROM users');
    });
  });

  describe('WHERE operators', () => {
    it('should handle = operator', () => {
      const { sql, params } = query.select('users').where('id', '=', 1).build();
      expect(sql).toContain('id = ?');
      expect(params).toEqual([1]);
    });

    it('should handle != operator', () => {
      const { sql, params } = query.select('users').where('status', '!=', 'deleted').build();
      expect(sql).toContain('status != ?');
      expect(params).toEqual(['deleted']);
    });

    it('should handle > operator', () => {
      const { sql, params } = query.select('users').where('age', '>', 18).build();
      expect(sql).toContain('age > ?');
      expect(params).toEqual([18]);
    });

    it('should handle < operator', () => {
      const { sql, params } = query.select('users').where('age', '<', 65).build();
      expect(sql).toContain('age < ?');
      expect(params).toEqual([65]);
    });

    it('should handle >= operator', () => {
      const { sql, params } = query.select('users').where('score', '>=', 80).build();
      expect(sql).toContain('score >= ?');
      expect(params).toEqual([80]);
    });

    it('should handle <= operator', () => {
      const { sql, params } = query.select('users').where('score', '<=', 100).build();
      expect(sql).toContain('score <= ?');
      expect(params).toEqual([100]);
    });

    it('should handle LIKE operator', () => {
      const { sql, params } = query.select('users').where('name', 'LIKE', '%john%').build();
      expect(sql).toContain('name LIKE ?');
      expect(params).toEqual(['%john%']);
    });

    it('should handle IN operator', () => {
      const { sql, params } = query
        .select('users')
        .whereIn('status', ['active', 'pending'])
        .build();
      expect(sql).toContain('status IN (?, ?)');
      expect(params).toEqual(['active', 'pending']);
    });

    it('should handle NOT IN operator', () => {
      const { sql, params } = query.select('users').whereNotIn('role', ['guest', 'banned']).build();
      expect(sql).toContain('role NOT IN (?, ?)');
      expect(params).toEqual(['guest', 'banned']);
    });

    it('should handle IS NULL', () => {
      const { sql, params } = query.select('users').whereNull('deleted_at').build();
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('should handle IS NOT NULL', () => {
      const { sql, params } = query.select('users').whereNotNull('email').build();
      expect(sql).toContain('email IS NOT NULL');
      expect(params).toEqual([]);
    });
  });

  describe('INSERT queries', () => {
    it('should build a simple INSERT query', () => {
      const builder = new InsertBuilder('users');
      const { sql, params } = builder
        .setColumns('name', 'email')
        .addRow('John', 'john@example.com')
        .build();

      expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(params).toEqual(['John', 'john@example.com']);
    });

    it('should build INSERT with object', () => {
      const builder = query.insert('users');
      const { sql, params } = builder
        .addObject({ name: 'John', email: 'john@example.com' })
        .build();

      expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(params).toEqual(['John', 'john@example.com']);
    });

    it('should build INSERT with multiple rows', () => {
      const builder = query.insert('users');
      const { sql, params } = builder
        .setColumns('name', 'email')
        .addRow('John', 'john@example.com')
        .addRow('Jane', 'jane@example.com')
        .build();

      expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?), (?, ?)');
      expect(params).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com']);
    });

    it('should build INSERT OR REPLACE', () => {
      const builder = query.insert('users');
      const { sql } = builder.replace().addObject({ id: 1, name: 'John' }).build();

      expect(sql).toBe('INSERT OR REPLACE INTO users (id, name) VALUES (?, ?)');
    });

    it('should handle null values', () => {
      const builder = query.insert('users');
      const { sql, params } = builder.addObject({ name: 'John', bio: null }).build();

      expect(sql).toBe('INSERT INTO users (name, bio) VALUES (?, ?)');
      expect(params).toEqual(['John', null]);
    });
  });

  describe('UPDATE queries', () => {
    it('should build a simple UPDATE query', () => {
      const builder = query.update('users');
      const { sql, params } = builder.set('name', 'John Updated').where('id', '=', 1).build();

      expect(sql).toBe('UPDATE users SET name = ? WHERE id = ?');
      expect(params).toEqual(['John Updated', 1]);
    });

    it('should build UPDATE with multiple SET values', () => {
      const builder = query.update('users');
      const { sql, params } = builder
        .setAll({ name: 'John', email: 'john@new.com', updated_at: '2024-01-01' })
        .where('id', '=', 1)
        .build();

      expect(sql).toBe('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?');
      expect(params).toEqual(['John', 'john@new.com', '2024-01-01', 1]);
    });

    it('should build UPDATE without WHERE (allowed in this implementation)', () => {
      const builder = query.update('users');
      const { sql } = builder.set('status', 'inactive').build();

      expect(sql).toBe('UPDATE users SET status = ?');
    });
  });

  describe('DELETE queries', () => {
    it('should build a simple DELETE query', () => {
      const builder = query.delete('users');
      const { sql, params } = builder.where('id', '=', 1).build();

      expect(sql).toBe('DELETE FROM users WHERE id = ?');
      expect(params).toEqual([1]);
    });

    it('should build DELETE with multiple WHERE conditions', () => {
      const builder = query.delete('users');
      const { sql, params } = builder
        .where('status', '=', 'deleted')
        .where('deleted_at', '<', '2023-01-01')
        .build();

      expect(sql).toBe('DELETE FROM users WHERE status = ? AND deleted_at < ?');
      expect(params).toEqual(['deleted', '2023-01-01']);
    });

    it('should build DELETE without WHERE (allowed in this implementation)', () => {
      const builder = query.delete('users');
      const { sql } = builder.build();

      expect(sql).toBe('DELETE FROM users');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries for values', () => {
      const { sql, params } = query
        .select('users')
        .where('name', '=', "Robert'; DROP TABLE users;--")
        .build();

      expect(sql).toBe('SELECT * FROM users WHERE name = ?');
      expect(params).toEqual(["Robert'; DROP TABLE users;--"]);
      expect(sql).not.toContain('DROP TABLE');
    });
  });

  describe('Edge Cases', () => {
    it('should handle boolean values', () => {
      const { sql, params } = query.select('users').where('is_active', '=', true).build();

      expect(params).toEqual([true]);
    });

    it('should handle numeric values', () => {
      const { sql, params } = query.select('products').where('price', '>', 99.99).build();

      expect(params).toEqual([99.99]);
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01');
      const builder = query.insert('events');
      const { params } = builder.addObject({ created_at: date }).build();

      expect(params).toContain(date);
    });
  });

  describe('QueryBuilder methods', () => {
    it('should support toSQL() for debugging', () => {
      const builder = query.select('users').where('id', '=', 1);
      const sql = builder.toSQL();

      expect(sql).toBe('SELECT * FROM users WHERE id = ?');
    });

    it('should support table aliases', () => {
      const builder = QueryBuilder.from('users', 'u');
      const { sql } = builder.select('u.id', 'u.name').build();

      expect(sql).toBe('SELECT u.id, u.name FROM users u');
    });
  });

  describe('Static factory methods', () => {
    it('should create QueryBuilder with from()', () => {
      const builder = QueryBuilder.from('users');
      expect(builder).toBeInstanceOf(QueryBuilder);
    });

    it('should create InsertBuilder with into()', () => {
      const builder = InsertBuilder.into('users');
      expect(builder).toBeInstanceOf(InsertBuilder);
    });

    it('should create UpdateBuilder with table()', () => {
      const builder = UpdateBuilder.table('users');
      expect(builder).toBeInstanceOf(UpdateBuilder);
    });

    it('should create DeleteBuilder with from()', () => {
      const builder = DeleteBuilder.from('users');
      expect(builder).toBeInstanceOf(DeleteBuilder);
    });
  });

  describe('query object convenience methods', () => {
    it('should have select method', () => {
      expect(typeof query.select).toBe('function');
    });

    it('should have insert method', () => {
      expect(typeof query.insert).toBe('function');
    });

    it('should have update method', () => {
      expect(typeof query.update).toBe('function');
    });

    it('should have delete method', () => {
      expect(typeof query.delete).toBe('function');
    });
  });
});

/**
 * Type-Safe Query Builder for DuckDB-WASM
 *
 * Provides a fluent API for building SQL queries with type safety
 * and parameterized values to prevent SQL injection.
 *
 * @module services/database/queryBuilder
 */

import { getDuckDBService, type DuckDBService } from './duckdbService';
import type { DuckDBQueryResult, DuckDBParams } from '@/types/duckdb';

/**
 * Comparison operators for WHERE clauses
 */
export type ComparisonOperator =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Sort direction
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Join type
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

/**
 * WHERE condition
 */
export interface WhereCondition {
  column: string;
  operator: ComparisonOperator;
  value?: unknown;
  logical?: LogicalOperator;
}

/**
 * JOIN clause
 */
export interface JoinClause {
  type: JoinType;
  table: string;
  alias?: string;
  on: string;
}

/**
 * ORDER BY clause
 */
export interface OrderByClause {
  column: string;
  direction: SortDirection;
}

/**
 * Query Builder class
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private duckdb: DuckDBService;
  private tableName: string;
  private tableAlias?: string;
  private selectColumns: string[] = ['*'];
  private whereConditions: WhereCondition[] = [];
  private joinClauses: JoinClause[] = [];
  private orderByClauses: OrderByClause[] = [];
  private groupByColumns: string[] = [];
  private havingConditions: WhereCondition[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private distinctFlag = false;

  constructor(table: string, alias?: string) {
    this.duckdb = getDuckDBService();
    this.tableName = table;
    this.tableAlias = alias;
  }

  /**
   * Create a new query builder for a table
   */
  static from<T = Record<string, unknown>>(table: string, alias?: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table, alias);
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectColumns = columns.length > 0 ? columns : ['*'];
    return this;
  }

  /**
   * Add DISTINCT to the query
   */
  distinct(): this {
    this.distinctFlag = true;
    return this;
  }

  /**
   * Add a WHERE condition
   */
  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      column,
      operator,
      value,
      logical: this.whereConditions.length > 0 ? 'AND' : undefined,
    });
    return this;
  }

  /**
   * Add an AND WHERE condition
   */
  andWhere(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      column,
      operator,
      value,
      logical: 'AND',
    });
    return this;
  }

  /**
   * Add an OR WHERE condition
   */
  orWhere(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      column,
      operator,
      value,
      logical: 'OR',
    });
    return this;
  }

  /**
   * Add a WHERE IN condition
   */
  whereIn(column: string, values: unknown[]): this {
    return this.where(column, 'IN', values);
  }

  /**
   * Add a WHERE NOT IN condition
   */
  whereNotIn(column: string, values: unknown[]): this {
    return this.where(column, 'NOT IN', values);
  }

  /**
   * Add a WHERE IS NULL condition
   */
  whereNull(column: string): this {
    return this.where(column, 'IS NULL');
  }

  /**
   * Add a WHERE IS NOT NULL condition
   */
  whereNotNull(column: string): this {
    return this.where(column, 'IS NOT NULL');
  }

  /**
   * Add a WHERE LIKE condition
   */
  whereLike(column: string, pattern: string): this {
    return this.where(column, 'LIKE', pattern);
  }

  /**
   * Add a JOIN clause
   */
  join(type: JoinType, table: string, on: string, alias?: string): this {
    this.joinClauses.push({ type, table, on, alias });
    return this;
  }

  /**
   * Add an INNER JOIN
   */
  innerJoin(table: string, on: string, alias?: string): this {
    return this.join('INNER', table, on, alias);
  }

  /**
   * Add a LEFT JOIN
   */
  leftJoin(table: string, on: string, alias?: string): this {
    return this.join('LEFT', table, on, alias);
  }

  /**
   * Add ORDER BY
   */
  orderBy(column: string, direction: SortDirection = 'ASC'): this {
    this.orderByClauses.push({ column, direction });
    return this;
  }

  /**
   * Add GROUP BY
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns.push(...columns);
    return this;
  }

  /**
   * Add HAVING condition
   */
  having(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.havingConditions.push({
      column,
      operator,
      value,
      logical: this.havingConditions.length > 0 ? 'AND' : undefined,
    });
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Build the SQL query and parameters
   */
  build(): { sql: string; params: DuckDBParams } {
    const params: DuckDBParams = [];
    let sql = 'SELECT ';

    // DISTINCT
    if (this.distinctFlag) {
      sql += 'DISTINCT ';
    }

    // SELECT columns
    sql += this.selectColumns.join(', ');

    // FROM table
    sql += ` FROM ${this.tableName}`;
    if (this.tableAlias) {
      sql += ` ${this.tableAlias}`;
    }

    // JOINs
    for (const join of this.joinClauses) {
      sql += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) {
        sql += ` ${join.alias}`;
      }
      sql += ` ON ${join.on}`;
    }

    // WHERE
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      sql += this.buildConditions(this.whereConditions, params);
    }

    // GROUP BY
    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    // HAVING
    if (this.havingConditions.length > 0) {
      sql += ' HAVING ';
      sql += this.buildConditions(this.havingConditions, params);
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      sql += ' ORDER BY ';
      sql += this.orderByClauses.map((o) => `${o.column} ${o.direction}`).join(', ');
    }

    // LIMIT
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // OFFSET
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  /**
   * Build conditions into SQL
   */
  private buildConditions(conditions: WhereCondition[], params: DuckDBParams): string {
    let sql = '';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      if (!condition) continue;

      // Add logical operator for subsequent conditions
      if (i > 0 && condition.logical) {
        sql += ` ${condition.logical} `;
      }

      sql += condition.column;

      switch (condition.operator) {
        case 'IS NULL':
        case 'IS NOT NULL':
          sql += ` ${condition.operator}`;
          break;

        case 'IN':
        case 'NOT IN':
          if (Array.isArray(condition.value)) {
            const placeholders = condition.value.map(() => '?').join(', ');
            sql += ` ${condition.operator} (${placeholders})`;
            params.push(...(condition.value as DuckDBParams));
          }
          break;

        default:
          sql += ` ${condition.operator} ?`;
          params.push(condition.value as DuckDBParams[0]);
          break;
      }
    }

    return sql;
  }

  /**
   * Execute the query and return results
   */
  async execute(): Promise<DuckDBQueryResult<T>> {
    const { sql, params } = this.build();
    return await this.duckdb.query<T>(sql, params);
  }

  /**
   * Execute the query and return first result or null
   */
  async first(): Promise<T | null> {
    this.limitValue = 1;
    const result = await this.execute();
    return result.success && result.rows.length > 0 ? (result.rows[0] ?? null) : null;
  }

  /**
   * Execute the query and return all results
   */
  async all(): Promise<T[]> {
    const result = await this.execute();
    return result.success ? result.rows : [];
  }

  /**
   * Execute a COUNT query
   */
  async count(): Promise<number> {
    const originalSelect = this.selectColumns;
    this.selectColumns = ['COUNT(*) as count'];

    const result = await this.execute();
    this.selectColumns = originalSelect;

    if (result.success && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return Number(row?.count ?? 0);
    }
    return 0;
  }

  /**
   * Check if any rows exist
   */
  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  /**
   * Get the generated SQL (for debugging)
   */
  toSQL(): string {
    return this.build().sql;
  }
}

/**
 * Insert Builder for INSERT statements
 */
export class InsertBuilder {
  private duckdb: DuckDBService;
  private tableName: string;
  private columns: string[] = [];
  private values: unknown[][] = [];
  private orReplace = false;

  constructor(table: string) {
    this.duckdb = getDuckDBService();
    this.tableName = table;
  }

  /**
   * Create a new insert builder
   */
  static into(table: string): InsertBuilder {
    return new InsertBuilder(table);
  }

  /**
   * Use INSERT OR REPLACE
   */
  replace(): this {
    this.orReplace = true;
    return this;
  }

  /**
   * Set columns to insert
   */
  setColumns(...columns: string[]): this {
    this.columns = columns;
    return this;
  }

  /**
   * Add a row of values
   */
  addRow(...values: unknown[]): this {
    this.values.push(values);
    return this;
  }

  /**
   * Add values from an object
   */
  addObject(obj: Record<string, unknown>): this {
    if (this.columns.length === 0) {
      this.columns = Object.keys(obj);
    }
    this.values.push(this.columns.map((col) => obj[col]));
    return this;
  }

  /**
   * Build the SQL and parameters
   */
  build(): { sql: string; params: DuckDBParams } {
    const params: DuckDBParams = [];
    let sql = this.orReplace ? 'INSERT OR REPLACE INTO ' : 'INSERT INTO ';
    sql += this.tableName;

    if (this.columns.length > 0) {
      sql += ` (${this.columns.join(', ')})`;
    }

    sql += ' VALUES ';

    const rowPlaceholders = this.values.map((row) => {
      params.push(...(row as DuckDBParams));
      return `(${row.map(() => '?').join(', ')})`;
    });

    sql += rowPlaceholders.join(', ');

    return { sql, params };
  }

  /**
   * Execute the insert
   */
  async execute(): Promise<{ success: boolean; error?: string }> {
    const { sql, params } = this.build();
    return await this.duckdb.execute(sql, params);
  }
}

/**
 * Update Builder for UPDATE statements
 */
export class UpdateBuilder {
  private duckdb: DuckDBService;
  private tableName: string;
  private setValues: Record<string, unknown> = {};
  private whereConditions: WhereCondition[] = [];

  constructor(table: string) {
    this.duckdb = getDuckDBService();
    this.tableName = table;
  }

  /**
   * Create a new update builder
   */
  static table(table: string): UpdateBuilder {
    return new UpdateBuilder(table);
  }

  /**
   * Set a column value
   */
  set(column: string, value: unknown): this {
    this.setValues[column] = value;
    return this;
  }

  /**
   * Set multiple column values
   */
  setAll(values: Record<string, unknown>): this {
    Object.assign(this.setValues, values);
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      column,
      operator,
      value,
      logical: this.whereConditions.length > 0 ? 'AND' : undefined,
    });
    return this;
  }

  /**
   * Build the SQL and parameters
   */
  build(): { sql: string; params: DuckDBParams } {
    const params: DuckDBParams = [];
    let sql = `UPDATE ${this.tableName} SET `;

    const setClauses = Object.entries(this.setValues).map(([column, value]) => {
      params.push(value as DuckDBParams[0]);
      return `${column} = ?`;
    });

    sql += setClauses.join(', ');

    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      for (let i = 0; i < this.whereConditions.length; i++) {
        const condition = this.whereConditions[i];
        if (!condition) continue;

        if (i > 0 && condition.logical) {
          sql += ` ${condition.logical} `;
        }

        if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
          sql += `${condition.column} ${condition.operator}`;
        } else {
          sql += `${condition.column} ${condition.operator} ?`;
          params.push(condition.value as DuckDBParams[0]);
        }
      }
    }

    return { sql, params };
  }

  /**
   * Execute the update
   */
  async execute(): Promise<{ success: boolean; error?: string }> {
    const { sql, params } = this.build();
    return await this.duckdb.execute(sql, params);
  }
}

/**
 * Delete Builder for DELETE statements
 */
export class DeleteBuilder {
  private duckdb: DuckDBService;
  private tableName: string;
  private whereConditions: WhereCondition[] = [];

  constructor(table: string) {
    this.duckdb = getDuckDBService();
    this.tableName = table;
  }

  /**
   * Create a new delete builder
   */
  static from(table: string): DeleteBuilder {
    return new DeleteBuilder(table);
  }

  /**
   * Add WHERE condition
   */
  where(column: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      column,
      operator,
      value,
      logical: this.whereConditions.length > 0 ? 'AND' : undefined,
    });
    return this;
  }

  /**
   * Build the SQL and parameters
   */
  build(): { sql: string; params: DuckDBParams } {
    const params: DuckDBParams = [];
    let sql = `DELETE FROM ${this.tableName}`;

    if (this.whereConditions.length > 0) {
      sql += ' WHERE ';
      for (let i = 0; i < this.whereConditions.length; i++) {
        const condition = this.whereConditions[i];
        if (!condition) continue;

        if (i > 0 && condition.logical) {
          sql += ` ${condition.logical} `;
        }

        if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
          sql += `${condition.column} ${condition.operator}`;
        } else {
          sql += `${condition.column} ${condition.operator} ?`;
          params.push(condition.value as DuckDBParams[0]);
        }
      }
    }

    return { sql, params };
  }

  /**
   * Execute the delete
   */
  async execute(): Promise<{ success: boolean; error?: string }> {
    const { sql, params } = this.build();
    return await this.duckdb.execute(sql, params);
  }
}

/**
 * Convenience functions for creating builders
 */
export const query = {
  select: <T = Record<string, unknown>>(table: string, alias?: string) =>
    QueryBuilder.from<T>(table, alias),
  insert: (table: string) => InsertBuilder.into(table),
  update: (table: string) => UpdateBuilder.table(table),
  delete: (table: string) => DeleteBuilder.from(table),
};

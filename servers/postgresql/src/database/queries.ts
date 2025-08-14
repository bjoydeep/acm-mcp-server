import { DatabaseConnection } from './connection.js';
import { QueryResult, TableInfo, TableSchema, ColumnInfo, QueryOptions } from '../types/index.js';

export class DatabaseQueries {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async executeQuery(sql: string, parameters?: any[], options?: QueryOptions): Promise<QueryResult> {
    try {
      const result = await this.db.query(sql, parameters);
      
      // Debug logging to understand the result structure
      console.error('Query result structure:', {
        hasRows: !!result.rows,
        rowsType: typeof result.rows,
        rowsIsArray: Array.isArray(result.rows),
        rowsLength: result.rows?.length,
        fields: result.fields?.length,
        rowCount: result.rowCount
      });
      
      // Convert row objects to arrays if needed
      const rowsAsArrays = result.rows.map(row => {
        if (Array.isArray(row)) {
          return row;
        } else {
          // Convert object to array based on field order
          return result.fields.map(field => row[field.name]);
        }
      });
      
      const queryResult: QueryResult = {
        columns: result.fields.map(field => field.name),
        rows: rowsAsArrays,
        rowCount: result.rowCount || 0,
        executionTime: (result as any).executionTime
      };

      // Apply row limit if specified
      if (options?.maxRows && queryResult.rows.length > options.maxRows) {
        queryResult.rows = queryResult.rows.slice(0, options.maxRows);
      }

      return queryResult;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        schemaname as schema,
        tablename as table_name
      FROM pg_tables 
      WHERE schemaname IN ('public', 'search')
      ORDER BY schemaname, tablename
    `;

    const result = await this.executeQuery(sql);
    
    return result.rows.map(row => ({
      tableName: row[1], // tablename
      schema: row[0],    // schemaname
      rowCount: undefined // We'll get this separately if needed
    }));
  }

  async describeTable(tableName: string, schema: string = 'public'): Promise<TableSchema> {
    // Get column information
    const columnSql = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        col_description((table_schema||'.'||table_name)::regclass, ordinal_position) as description
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    const columnResult = await this.executeQuery(columnSql, [schema, tableName]);
    
    const columns: ColumnInfo[] = columnResult.rows.map(row => ({
      columnName: row[0],
      dataType: row[1],
      isNullable: row[2] === 'YES',
      defaultValue: row[3] || undefined,
      description: row[4] || undefined
    }));

    // Get index information
    const indexSql = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = $1 AND tablename = $2
    `;

    const indexResult = await this.executeQuery(indexSql, [schema, tableName]);
    const indexes = indexResult.rows.map(row => row[0]);

    // Get constraint information
    const constraintSql = `
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = $1 AND tc.table_name = $2
    `;

    const constraintResult = await this.executeQuery(constraintSql, [schema, tableName]);
    const constraints = constraintResult.rows.map(row => 
      `${row[1]} ${row[0]} (${row[2]})`
    );

    return {
      tableName,
      schema,
      columns,
      indexes,
      constraints
    };
  }

  async getTableData(tableName: string, schema: string = 'public', limit: number = 10): Promise<QueryResult> {
    const sql = `SELECT * FROM ${schema}.${tableName} LIMIT $1`;
    return await this.executeQuery(sql, [limit]);
  }

  async getTableRowCount(tableName: string, schema: string = 'public'): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${schema}.${tableName}`;
    const result = await this.executeQuery(sql);
    return parseInt(result.rows[0][0]);
  }

  async getTableSize(tableName: string, schema: string = 'public'): Promise<string> {
    const sql = `
      SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) as size
    `;
    const result = await this.executeQuery(sql, [`${schema}.${tableName}`]);
    return result.rows[0][0];
  }

  async searchTables(searchTerm: string): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        schemaname as schema,
        tablename as table_name
      FROM pg_tables 
      WHERE tablename ILIKE $1 OR schemaname ILIKE $1
      ORDER BY schemaname, tablename
    `;
    
    const result = await this.executeQuery(sql, [`%${searchTerm}%`]);
    
    return result.rows.map(row => ({
      tableName: row[1],
      schema: row[0]
    }));
  }

  async getDatabaseStats(): Promise<{
    tableCount: number;
    totalRows: number;
    databaseSize: string;
    activeConnections: number;
  }> {
    // Get table count
    const tableCountSql = `
      SELECT COUNT(*) as count 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    const tableCountResult = await this.executeQuery(tableCountSql);
    const tableCount = parseInt(tableCountResult.rows[0][0]);

    // Get total rows (simplified approach)
    let totalRows = 0;
    try {
      const totalRowsSql = `
        SELECT COALESCE(SUM(n_tup_ins + n_tup_upd + n_tup_del), 0) as total_rows
        FROM pg_stat_user_tables
      `;
      const totalRowsResult = await this.executeQuery(totalRowsSql);
      totalRows = parseInt(totalRowsResult.rows[0][0]) || 0;
    } catch (error) {
      // If pg_stat_user_tables is not available, we'll use 0
      totalRows = 0;
    }

    // Get database size
    const sizeSql = `SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    const sizeResult = await this.executeQuery(sizeSql);
    const databaseSize = sizeResult.rows[0][0];

    // Get active connections
    const connectionsSql = `
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `;
    const connectionsResult = await this.executeQuery(connectionsSql);
    const activeConnections = parseInt(connectionsResult.rows[0][0]);

    return {
      tableCount,
      totalRows,
      databaseSize,
      activeConnections
    };
  }
} 
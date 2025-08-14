import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DatabaseConnection } from './database/connection.js';
import { DatabaseQueries } from './database/queries.js';
import { QueryResult, TableSchema } from './types/index.js';
import { z } from 'zod';

class PostgresMCPServer {
  private server: McpServer;
  private dbConnection: DatabaseConnection;
  private dbQueries: DatabaseQueries;

  constructor(databaseUrl: string) {
    this.server = new McpServer({
      name: 'postgres-mcp-server',
      version: '1.0.0',
    });

    this.dbConnection = new DatabaseConnection(databaseUrl);
    this.dbQueries = new DatabaseQueries(this.dbConnection);

    this.setupTools();
  }

  private setupTools() {
    // Query database tool
    this.server.registerTool(
      'query_database',
      {
        title: 'Query Database',
        description: 'Execute a SQL query and return results',
        inputSchema: {
          sql: z.string().describe('The SQL query to execute'),
          parameters: z.array(z.string()).optional().describe('Query parameters (for parameterized queries)'),
          maxRows: z.number().optional().default(100).describe('Maximum number of rows to return'),
        },
      },
      async ({ sql, parameters, maxRows }) => {
        try {
          console.error('Executing query:', sql);
          console.error('Parameters:', parameters);
          
          const results = await this.dbQueries.executeQuery(
            sql,
            parameters,
            { maxRows }
          );

          console.error('Query results:', {
            columns: results.columns,
            rowsLength: results.rows?.length,
            rowCount: results.rowCount
          });

          return this.formatQueryResults(results, 'Query Results');
        } catch (error) {
          console.error('Query error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: `Query failed: ${errorMessage}\n\nPlease check your SQL syntax and ensure the query is valid for PostgreSQL.`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // List tables tool
    this.server.registerTool(
      'list_tables',
      {
        title: 'List Tables',
        description: 'Get a list of all tables in the database',
        inputSchema: {
          schema: z.string().optional().default('public').describe('Schema name to filter by'),
        },
      },
      async ({ schema }) => {
        const tables = await this.dbQueries.listTables();
        
        if (tables.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tables found in the database.',
              },
            ],
          };
        }

        const tableList = tables
          .map((table, index) => {
            const rowCountText = table.rowCount ? ` (${table.rowCount} rows)` : '';
            return `${index + 1}. **${table.schema}.${table.tableName}**${rowCountText}`;
          })
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `## Database Tables\n\n${tableList}`,
            },
          ],
        };
      }
    );

    // Describe table tool
    this.server.registerTool(
      'describe_table',
      {
        title: 'Describe Table',
        description: 'Get detailed schema information for a table',
        inputSchema: {
          tableName: z.string().describe('Name of the table to describe'),
          schema: z.string().optional().default('public').describe('Schema name'),
        },
      },
      async ({ tableName, schema }) => {
        const tableSchema = await this.dbQueries.describeTable(tableName, schema);
        
        const columnsText = tableSchema.columns
          .map(col => {
            const nullable = col.isNullable ? 'NULL' : 'NOT NULL';
            const defaultText = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
            const descText = col.description ? ` - ${col.description}` : '';
            return `- **${col.columnName}** (${col.dataType}) ${nullable}${defaultText}${descText}`;
          })
          .join('\n');

        const indexesText = tableSchema.indexes && tableSchema.indexes.length > 0 
          ? `\n\n**Indexes:**\n${tableSchema.indexes.map(idx => `- ${idx}`).join('\n')}`
          : '';

        const constraintsText = tableSchema.constraints && tableSchema.constraints.length > 0
          ? `\n\n**Constraints:**\n${tableSchema.constraints.map(con => `- ${con}`).join('\n')}`
          : '';

        return {
          content: [
            {
              type: 'text',
              text: `## Table Schema: ${tableSchema.schema}.${tableSchema.tableName}\n\n**Columns:**\n${columnsText}${indexesText}${constraintsText}`,
            },
          ],
        };
      }
    );

    // Get table data tool
    this.server.registerTool(
      'get_table_data',
      {
        title: 'Get Table Data',
        description: 'Get sample data from a table',
        inputSchema: {
          tableName: z.string().describe('Name of the table'),
          schema: z.string().optional().default('public').describe('Schema name'),
          limit: z.number().optional().default(10).describe('Number of rows to return'),
        },
      },
      async ({ tableName, schema, limit }) => {
        const results = await this.dbQueries.getTableData(
          tableName,
          schema,
          limit
        );

        return this.formatQueryResults(results, `Table Data: ${schema || 'public'}.${tableName}`);
      }
    );

    // Get database stats tool
    this.server.registerTool(
      'get_database_stats',
      {
        title: 'Get Database Stats',
        description: 'Get database statistics and information',
        inputSchema: {},
      },
      async () => {
        const stats = await this.dbQueries.getDatabaseStats();
        
        return {
          content: [
            {
              type: 'text',
              text: `## Database Statistics\n\n- **Tables:** ${stats.tableCount}\n- **Total Rows:** ${stats.totalRows.toLocaleString()}\n- **Database Size:** ${stats.databaseSize}\n- **Active Connections:** ${stats.activeConnections}`,
            },
          ],
        };
      }
    );

    // Search tables tool
    this.server.registerTool(
      'search_tables',
      {
        title: 'Search Tables',
        description: 'Search for tables by name',
        inputSchema: {
          searchTerm: z.string().describe('Search term to match table names'),
        },
      },
      async ({ searchTerm }) => {
        const tables = await this.dbQueries.searchTables(searchTerm);
        
        if (tables.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No tables found matching "${searchTerm}".`,
              },
            ],
          };
        }

        const tableList = tables
          .map((table, index) => `${index + 1}. **${table.schema}.${table.tableName}**`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `## Tables Matching "${searchTerm}"\n\n${tableList}`,
            },
          ],
        };
      }
    );
  }

  private formatQueryResults(results: QueryResult, title: string): any {
    if (results.rowCount === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `${title}\n\nNo results returned.`,
          },
        ],
      };
    }

    // Create a markdown table
    const headerRow = `| ${results.columns.join(' | ')} |`;
    const separatorRow = `| ${results.columns.map(() => '---').join(' | ')} |`;
    const dataRows = results.rows
      .map(row => `| ${row.map(cell => this.escapeMarkdown(cell?.toString() || 'NULL')).join(' | ')} |`)
      .join('\n');

    const executionTimeText = results.executionTime 
      ? `\n\n*Query executed in ${results.executionTime}ms*`
      : '';

    const rowCountText = results.rowCount && results.rowCount > 0 
      ? `\n\n*Showing ${Math.min(results.rows.length, results.rowCount)} of ${results.rowCount} rows*`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `## ${title}\n\n${headerRow}\n${separatorRow}\n${dataRows}${executionTimeText}${rowCountText}`,
        },
      ],
    };
  }

  private escapeMarkdown(text: string): string {
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, '<br>')
      .replace(/\r/g, '');
  }

  async run() {
    // Test database connection
    const isConnected = await this.dbConnection.testConnection();
    if (!isConnected) {
      console.error('Failed to connect to PostgreSQL database. Please check your configuration.');
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PostgreSQL MCP Server started successfully');
  }

  // Public methods for HTTP server
  async testConnection(): Promise<boolean> {
    return await this.dbConnection.testConnection();
  }

  async executeQuery(sql: string, parameters?: any[], options?: { maxRows?: number }): Promise<any> {
    const results = await this.dbQueries.executeQuery(sql, parameters, options);
    return results;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    // This would need to be implemented to call the actual MCP tools
    // For now, we'll implement the most common ones
    switch (toolName) {
      case 'query_database':
        const results = await this.executeQuery(args.sql, args.parameters, { maxRows: args.maxRows });
        return this.formatQueryResults(results, 'Query Results');
      case 'get_database_stats':
        const stats = await this.dbQueries.getDatabaseStats();
        return {
          content: [
            {
              type: 'text',
              text: `## Database Statistics\n\n- **Tables:** ${stats.tableCount}\n- **Total Rows:** ${stats.totalRows.toLocaleString()}\n- **Database Size:** ${stats.databaseSize}\n- **Active Connections:** ${stats.activeConnections}`,
            },
          ],
        };
      case 'list_tables':
        const tables = await this.dbQueries.listTables();
        if (tables.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tables found in the database.',
              },
            ],
          };
        }
        const tableList = tables
          .map((table, index) => {
            const rowCountText = table.rowCount ? ` (${table.rowCount} rows)` : '';
            return `${index + 1}. **${table.schema}.${table.tableName}**${rowCountText}`;
          })
          .join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `## Database Tables\n\n${tableList}`,
            },
          ],
        };
      case 'search_tables':
        const searchResults = await this.dbQueries.searchTables(args.searchTerm);
        if (searchResults.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No tables found matching "${args.searchTerm}".`,
              },
            ],
          };
        }
        const searchTableList = searchResults
          .map((table, index) => `${index + 1}. **${table.schema}.${table.tableName}**`)
          .join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `## Tables Matching "${args.searchTerm}"\n\n${searchTableList}`,
            },
          ],
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  getAvailableTools(): string[] {
    return [
      'query_database',
      'get_database_stats', 
      'list_tables',
      'search_tables'
    ];
  }

  async getDatabaseStats(): Promise<any> {
    return await this.dbQueries.getDatabaseStats();
  }

  async listTables(): Promise<any> {
    return await this.dbQueries.listTables();
  }

  // Get the underlying MCP server for transport integration
  getMcpServer(): McpServer {
    return this.server;
  }
}

export { PostgresMCPServer }; 
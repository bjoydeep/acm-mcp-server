import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { PostgresMCPServer } from './server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

interface QueryRequest {
  sql: string;
  parameters?: any[];
  maxRows?: number;
}

interface ToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

class HTTPMCPServer {
  private app: express.Application;
  private mcpServer: PostgresMCPServer;
  private port: number;
  private transports: Record<string, StreamableHTTPServerTransport> = {};
  private sseConnections: Record<string, express.Response> = {};

  constructor(databaseUrl: string, port: number = 3000) {
    this.port = port;
    this.mcpServer = new PostgresMCPServer(databaseUrl);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id']
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // MCP Streamable HTTP endpoint (latest protocol)
    this.app.all('/mcp', async (req, res) => {
      console.log(`Received ${req.method} request to /mcp`);

      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports[sessionId]) {
          // Reuse existing transport
          transport = this.transports[sessionId];
        } else if (!sessionId && req.method === 'POST') {
          // Create new transport for initialization
          const eventStore = new InMemoryEventStore();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore,
            onsessioninitialized: (sessionId) => {
              console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
              this.transports[sessionId] = transport;
            }
          });

          // Set up onclose handler
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports[sid]) {
              console.log(`Transport closed for session ${sid}, removing from transports map`);
              delete this.transports[sid];
            }
          };

          // Connect the transport to the MCP server
          const mcpServer = this.mcpServer.getMcpServer();
          await mcpServer.connect(transport);
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Invalid session or request method',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // Legacy SSE endpoint for backward compatibility
    this.app.get('/sse', (req, res) => {
      const sessionId = Date.now().toString();
      
      console.log(`[SSE] New connection request, creating session: ${sessionId}`);
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Store the SSE connection
      this.sseConnections[sessionId] = res;
      console.log(`[SSE] Stored connection for session: ${sessionId}, total connections: ${Object.keys(this.sseConnections).length}`);

      // Send initial endpoint message (mirroring Neo4j approach)
      res.write(`event: endpoint\ndata: /messages/?session_id=${sessionId}\n\n`);
      console.log(`[SSE] Sent endpoint message for session: ${sessionId}`);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`: ping - ${new Date().toISOString()}\n\n`);
      }, 15000);

      req.on('close', () => {
        console.log(`[SSE] Connection closed for session: ${sessionId}`);
        clearInterval(heartbeat);
        delete this.sseConnections[sessionId];
        console.log(`[SSE] Removed connection for session: ${sessionId}, remaining connections: ${Object.keys(this.sseConnections).length}`);
      });
    });

    // Messages endpoint for SSE transport (required by MCP clients)
    this.app.post('/messages/', async (req, res) => {
      const sessionId = req.query.session_id as string;
      
      console.log(`[MESSAGES] Received POST request for session: ${sessionId}`);
      console.log(`[MESSAGES] Request body:`, JSON.stringify(req.body, null, 2));
      console.log(`[MESSAGES] Available sessions:`, Object.keys(this.sseConnections));
      
      if (!sessionId) {
        console.log(`[MESSAGES] Error: No session ID provided`);
        return res.status(400).send('Invalid session ID');
      }

      try {
        // Accept the message immediately (like Neo4j)
        res.status(200).send('Accepted');
        console.log(`[MESSAGES] Message accepted for session: ${sessionId}`);
        
        // Get the SSE connection for this session
        const sseRes = this.sseConnections[sessionId];
        if (!sseRes) {
          console.error(`[MESSAGES] No SSE connection found for session: ${sessionId}`);
          console.error(`[MESSAGES] Available sessions:`, Object.keys(this.sseConnections));
          return;
        }

        console.log(`[MESSAGES] Found SSE connection for session: ${sessionId}`);

        // Handle the MCP message
        const message = req.body;
        
        if (message.method === 'initialize') {
          console.log(`[MESSAGES] Handling initialize method`);
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: {
                tools: {
                  listChanged: true
                }
              },
              serverInfo: {
                name: 'postgres-mcp-server',
                version: '1.0.0'
              }
            }
          };
          
          console.log(`[MESSAGES] Sending initialize response:`, JSON.stringify(response, null, 2));
          sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        } else if (message.method === 'tools/list') {
          console.log(`[MESSAGES] Handling tools/list method`);
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [
                {
                  name: 'query_database',
                  description: 'Execute a SQL query and return results',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      sql: {
                        type: 'string',
                        description: 'The SQL query to execute'
                      },
                      parameters: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Query parameters (for parameterized queries)'
                      },
                      maxRows: {
                        type: 'number',
                        description: 'Maximum number of rows to return',
                        default: 100
                      }
                    },
                    required: ['sql']
                  }
                },
                {
                  name: 'get_database_stats',
                  description: 'Get database statistics and information',
                  inputSchema: {
                    type: 'object',
                    properties: {}
                  }
                },
                {
                  name: 'list_tables',
                  description: 'Get a list of all tables in the database',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      schema: {
                        type: 'string',
                        description: 'Schema name to filter by',
                        default: 'public'
                      }
                    }
                  }
                },
                {
                  name: 'search_tables',
                  description: 'Search for tables by name',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      searchTerm: {
                        type: 'string',
                        description: 'Search term to match table names'
                      }
                    },
                    required: ['searchTerm']
                  }
                }
              ]
            }
          };
          
          console.log(`[MESSAGES] Sending tools/list response:`, JSON.stringify(response, null, 2));
          sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        } else if (message.method === 'notifications/initialized') {
          console.log(`[MESSAGES] Handling notifications/initialized (ignoring notification)`);
          // This is a notification, not a request, so we don't send a response
        } else if (message.method === 'resources/list') {
          console.log(`[MESSAGES] Handling resources/list method`);
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              resources: []
            }
          };
          
          console.log(`[MESSAGES] Sending resources/list response:`, JSON.stringify(response, null, 2));
          sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        } else if (message.method === 'prompts/list') {
          console.log(`[MESSAGES] Handling prompts/list method`);
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              prompts: []
            }
          };
          
          console.log(`[MESSAGES] Sending prompts/list response:`, JSON.stringify(response, null, 2));
          sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        } else if (message.method === 'tools/call') {
          console.log(`[MESSAGES] Handling tools/call method`);
          console.log(`[MESSAGES] Tool call params:`, JSON.stringify(message.params, null, 2));
          
          try {
            const { name, arguments: args } = message.params;
            const result = await this.mcpServer.callTool(name, args);
            
            // The result should already be in the correct format with content array
            const response = {
              jsonrpc: '2.0',
              id: message.id,
              result: result
            };
            
            console.log(`[MESSAGES] Sending tools/call response:`, JSON.stringify(response, null, 2));
            sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[MESSAGES] Error in tools/call:`, errorMessage);
            
            const response = {
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32603,
                message: `Tool execution failed: ${errorMessage}`
              }
            };
            
            console.log(`[MESSAGES] Sending tools/call error response:`, JSON.stringify(response, null, 2));
            sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          }
        } else {
          console.log(`[MESSAGES] Handling unknown method: ${message.method}`);
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
          
          console.log(`[MESSAGES] Sending error response:`, JSON.stringify(response, null, 2));
          sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MESSAGES] Error handling message:`, errorMessage);
      }
    });

    // Legacy query endpoint for backward compatibility
    this.app.post('/sse/query', async (req, res) => {
      const { sql, parameters, maxRows }: QueryRequest = req.body;

      if (!sql) {
        return res.status(400).json({ error: 'SQL query is required' });
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      try {
        const results = await this.mcpServer.executeQuery(sql, parameters, { maxRows });
        
        res.write(`event: results\ndata: ${JSON.stringify(results)}\n\n`);
        res.write(`event: complete\ndata: success\n\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.write(`event: error\ndata: ${errorMessage}\n\n`);
      } finally {
        res.end();
      }
    });

    // Legacy tool endpoint for backward compatibility
    this.app.post('/sse/tools/:toolName', async (req, res) => {
      const { toolName } = req.params;
      const { arguments: args }: ToolCallRequest = req.body;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      try {
        const result = await this.mcpServer.callTool(toolName, args);
        
        res.write(`event: results\ndata: ${JSON.stringify(result)}\n\n`);
        res.write(`event: complete\ndata: success\n\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.write(`event: error\ndata: ${errorMessage}\n\n`);
      } finally {
        res.end();
      }
    });

    // List available tools
    this.app.get('/tools', (req, res) => {
      const tools = this.mcpServer.getAvailableTools();
      res.json({ tools });
    });

    // Get database statistics
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.mcpServer.getDatabaseStats();
        res.json(stats);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
      }
    });

    // List tables
    this.app.get('/tables', async (req, res) => {
      try {
        const tables = await this.mcpServer.listTables();
        res.json({ tables });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
      }
    });

    // MCP server info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        name: 'PostgreSQL MCP Server',
        version: '1.0.0',
        description: 'MCP server providing PostgreSQL database access',
        capabilities: {
          streamableHttp: true,
          sse: true, // legacy support
          tools: this.mcpServer.getAvailableTools()
        },
        endpoints: {
          mcp: '/mcp', // Latest Streamable HTTP transport
          sse: '/sse', // Legacy SSE endpoint
          query: '/sse/query', // Legacy query endpoint
          tools: '/sse/tools/:toolName', // Legacy tool endpoint
          health: '/health',
          info: '/info'
        },
        protocol: {
          primary: 'streamable-http-2025-03-26',
          legacy: 'sse-2024-11-05'
        }
      });
    });
  }

  async start() {
    try {
      // Test database connection
      const isConnected = await this.mcpServer.testConnection();
      if (!isConnected) {
        console.error('Failed to connect to PostgreSQL database. Please check your configuration.');
        process.exit(1);
      }

      this.app.listen(this.port, () => {
        console.error(`HTTP MCP Server running on http://localhost:${this.port}`);
        console.error('Available endpoints:');
        console.error('  GET/POST/DELETE /mcp - MCP Streamable HTTP (latest)');
        console.error('  GET  /sse        - Legacy SSE endpoint');
        console.error('  POST /sse/query  - Legacy SQL query (SSE)');
        console.error('  POST /sse/tools/:name - Legacy tool calls (SSE)');
        console.error('  GET  /tools      - List available tools');
        console.error('  GET  /stats      - Database statistics');
        console.error('  GET  /tables     - List tables');
        console.error('  GET  /info       - Server info');
        console.error('  GET  /health     - Health check');
      });
    } catch (error) {
      console.error('Failed to start HTTP server:', error);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  // Read from environment variables with fallbacks
  const databaseUrl = process.env.DATABASE_URL || process.argv[2];
  const port = parseInt(process.env.PORT || process.argv[3] || '3000');

  if (!databaseUrl) {
    console.error('Usage: node http-server.js <database-url> [port]');
    console.error('Or set environment variables:');
    console.error('  DATABASE_URL=postgresql://user:pass@localhost:5432/db');
    console.error('  PORT=3000');
    console.error('');
    console.error('Examples:');
    console.error('  node http-server.js postgresql://user:pass@localhost:5432/db 3000');
    console.error('  DATABASE_URL=postgresql://user:pass@localhost:5432/db PORT=3000 node http-server.js');
    process.exit(1);
  }

  const server = new HTTPMCPServer(databaseUrl, port);
  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { HTTPMCPServer }; 
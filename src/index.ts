#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  listClusterDesc, listClustersArgs, listClusters,
  connectClusterDesc, connectClusterArgs, connectCluster
} from './tools/clusters';
import { kubectl, kubectlArgs, kubectlDesc } from "./tools/kubectl";
import { registerResources } from './resources';

const server = new McpServer({
  name: "acm-mcp-server",
  version: "1.0.1",
  capabilities: {
    resources: {},
    tools: {},
    // prompts: {},
  },
})

// Register cluster management tools
server.tool(
  "clusters",
  listClusterDesc,
  listClustersArgs,
  async (args, extra) => listClusters(args)
)

server.tool(
  "connect_cluster",
  connectClusterDesc,
  connectClusterArgs,
  async (args, extra) => connectCluster(args)
)

server.tool(
  "kubectl",
  kubectlDesc,
  kubectlArgs,
  async (args, extra) => kubectl(args)
)

// Register all ACM resources
registerResources(server);

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACM MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
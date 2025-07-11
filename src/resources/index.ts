import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resourceManager } from './api';

// Register all ACM resources with the MCP server
export function registerResources(server: McpServer): void {
  // Register individual resource schemas
  const allResources = resourceManager.getAllResources();

  for (const resource of allResources) {
    server.resource(
      resource.name.toLowerCase(),
      `acm://${resource.name.toLowerCase()}`,
      {
        name: `${resource.name} Schema`,
        description: resource.description,
        mimeType: "application/json"
      },
      async (uri: URL) => {
        const resourceInfo = resourceManager.getResourceInfo(resource.name.toLowerCase());
        if (!resourceInfo) {
          throw new Error(`${resource.name} resource not found`);
        }

        const { resource: resourceData, schemaProperties } = resourceInfo;
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              name: resourceData.name,
              kind: resourceData.kind,
              apiVersion: resourceData.apiVersion,
              description: resourceData.description,
              categories: resourceData.categories,
              labels: resourceData.labels,
              usageHint: resourceData.usageHint,
              schemaProperties: schemaProperties,
              schema: resourceData.schema,
              example: resourceData.example
            }, null, 2)
          }]
        };
      }
    );
  }

  console.error(`Registered ${allResources.length} ACM resources with MCP server`);
} 
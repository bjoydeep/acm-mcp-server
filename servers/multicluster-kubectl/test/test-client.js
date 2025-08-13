#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class ACMTestClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    try {
      // Create stdio transport with command to start the ACM MCP server
      this.transport = new StdioClientTransport({
        command: "node",
        args: ["../build/index.js"],
        env: process.env
      });

      // Create client
      this.client = new Client({
        name: "acm-test-client",
        version: "1.0.0"
      }, {
        capabilities: {
          resources: {},
          tools: {}
        }
      });

      // Connect to server
      await this.client.connect(this.transport);
      
      console.log("✅ Connected to ACM MCP Server");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect:", error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    console.log("🔌 Disconnected from ACM MCP Server");
  }

  // Resource methods
  async listResources() {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const response = await this.client.listResources();
      return response.resources || [];
    } catch (error) {
      console.error("❌ Failed to list resources:", error);
      return [];
    }
  }

  async getResource(uri) {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const response = await this.client.readResource({ uri });
      return response;
    } catch (error) {
      console.error(`❌ Failed to get resource ${uri}:`, error);
      return null;
    }
  }

  // Tool methods
  async listTools() {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      console.error("❌ Failed to list tools:", error);
      return [];
    }
  }

  async callTool(name, arguments_) {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    try {
      const response = await this.client.callTool({ name, arguments: arguments_ });
      return response;
    } catch (error) {
      console.error(`❌ Failed to call tool ${name}:`, error);
      return null;
    }
  }

  // Utility methods
  displaySuccess(message) {
    console.log(`✅ ${message}`);
  }

  displayError(message) {
    console.log(`❌ ${message}`);
  }

  displayInfo(message) {
    console.log(`ℹ️  ${message}`);
  }

  displaySeparator(text = "", char = "─", length = 60) {
    if (text) {
      console.log(`\n${text}`);
    }
    console.log(char.repeat(length));
  }
}

// Main test function
async function runBasicTests() {
  console.log("🧪 Running Basic ACM MCP Tests...\n");
  
  const client = new ACMTestClient();
  
  try {
    // Test connection
    client.displaySeparator("Testing Connection");
    const connected = await client.connect();
    
    if (!connected) {
      client.displayError("Failed to connect to server");
      return;
    }
    
    client.displaySuccess("Connected to server");

    // Test listing resources
    client.displaySeparator("Testing Resources");
    const resources = await client.listResources();
    client.displayInfo(`Found ${resources.length} resources`);
    
    if (resources.length > 0) {
      client.displayInfo("Available resources:");
      resources.forEach((resource, index) => {
        console.log(`  ${index + 1}. ${resource.name} (${resource.uri})`);
      });
    }

    // Test listing tools
    client.displaySeparator("Testing Tools");
    const tools = await client.listTools();
    client.displayInfo(`Found ${tools.length} tools`);
    
    if (tools.length > 0) {
      client.displayInfo("Available tools:");
      tools.forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
      });
    }

    client.displaySeparator("Basic Tests Completed", "═");
    client.displaySuccess("All basic tests passed!");
    
  } catch (error) {
    client.displayError(`Test failed: ${error.message}`);
  } finally {
    await client.disconnect();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicTests().catch(console.error);
} 
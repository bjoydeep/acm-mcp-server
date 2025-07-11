#!/usr/bin/env node

import { ACMTestClient } from './test-client.js';

async function testTools() {
  console.log("🧪 Testing ACM MCP Tools...\n");
  
  const client = new ACMTestClient();
  
  try {
    // Connect to server
    const connected = await client.connect();
    if (!connected) {
      client.displayError("Failed to connect to server");
      return;
    }

    // Test 1: List all tools
    client.displaySeparator("Test 1: List All Tools");
    const tools = await client.listTools();
    
    if (tools.length === 0) {
      client.displayError("No tools found");
      return;
    }
    
    client.displaySuccess(`Found ${tools.length} tools`);
    tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}`);
      console.log(`     Description: ${tool.description || 'N/A'}`);
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(`     Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
      }
      console.log();
    });

    // Test 2: Test clusters tool
    client.displaySeparator("Test 2: Test 'clusters' Tool");
    
    console.log("📋 Testing clusters tool...");
    const clustersResult = await client.callTool('clusters', {});
    
    if (clustersResult) {
      client.displaySuccess("Clusters tool executed successfully");
      
      if (clustersResult.content && clustersResult.content.length > 0) {
        const content = clustersResult.content[0];
        if (content.type === 'text') {
          console.log("Output:");
          console.log(content.text);
        }
      }
    } else {
      client.displayError("Failed to execute clusters tool");
    }

    // Test 3: Test kubectl tool with basic command
    client.displaySeparator("Test 3: Test 'kubectl' Tool");
    
    console.log("📋 Testing kubectl tool with 'version' command...");
    const kubectlResult = await client.callTool('kubectl', {
      command: 'kubectl version --client'
    });
    
    if (kubectlResult) {
      client.displaySuccess("Kubectl tool executed successfully");
      
      if (kubectlResult.content && kubectlResult.content.length > 0) {
        const content = kubectlResult.content[0];
        if (content.type === 'text') {
          console.log("Output:");
          console.log(content.text.substring(0, 200) + "..."); // Show first 200 chars
        }
      }
    } else {
      client.displayError("Failed to execute kubectl tool");
    }

    // Test 4: Test kubectl tool with cluster info
    client.displaySeparator("Test 4: Test kubectl cluster-info");
    
    console.log("📋 Testing kubectl cluster-info...");
    const clusterInfoResult = await client.callTool('kubectl', {
      command: 'kubectl cluster-info'
    });
    
    if (clusterInfoResult) {
      client.displaySuccess("Kubectl cluster-info executed successfully");
      
      if (clusterInfoResult.content && clusterInfoResult.content.length > 0) {
        const content = clusterInfoResult.content[0];
        if (content.type === 'text') {
          console.log("Output:");
          console.log(content.text);
        }
      }
    } else {
      client.displayError("Failed to execute kubectl cluster-info");
    }

    // Test 5: Test connect_cluster tool (this might fail without proper setup)
    client.displaySeparator("Test 5: Test 'connect_cluster' Tool (May Fail)");
    
    console.log("📋 Testing connect_cluster tool...");
    console.log("Note: This test may fail if no managed clusters are available");
    
    const connectResult = await client.callTool('connect_cluster', {
      cluster: 'test-cluster',
      clusterRole: 'cluster-admin'
    });
    
    if (connectResult) {
      if (connectResult.isErrored) {
        client.displayInfo("Connect cluster tool returned expected error (no test cluster)");
        console.log("Error message:");
        if (connectResult.content && connectResult.content.length > 0) {
          console.log(connectResult.content[0].text);
        }
      } else {
        client.displaySuccess("Connect cluster tool executed successfully");
      }
    } else {
      client.displayInfo("Connect cluster tool failed as expected (no test cluster)");
    }

    // Test 6: Test invalid tool
    client.displaySeparator("Test 6: Test Invalid Tool (Error Handling)");
    
    console.log("📋 Testing non-existent tool...");
    const invalidResult = await client.callTool('non-existent-tool', {});
    
    if (!invalidResult) {
      client.displaySuccess("Error handling works correctly for invalid tools");
    } else {
      client.displayError("Expected error for invalid tool, but got result");
    }

    // Test 7: Test tool parameter validation
    client.displaySeparator("Test 7: Test Parameter Validation");
    
    console.log("📋 Testing kubectl with invalid parameters...");
    const invalidParamsResult = await client.callTool('kubectl', {
      command: ''  // Invalid empty command
    });
    
    if (invalidParamsResult && invalidParamsResult.isErrored) {
      client.displaySuccess("Parameter validation works correctly");
    } else {
      client.displayInfo("Invalid parameters handled gracefully");
    }

    // Test 8: Performance test
    client.displaySeparator("Test 8: Performance Test");
    
    console.log("📋 Testing tool execution performance...");
    const startTime = Date.now();
    
    const promises = [
      client.callTool('clusters', {}),
      client.callTool('kubectl', { command: 'kubectl version --client' })
    ];
    
    const results = await Promise.all(promises);
    const successfulResults = results.filter(result => result !== null);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    client.displayInfo(`Executed ${successfulResults.length}/${results.length} tools in ${duration}ms`);
    
    if (duration < 10000) {
      client.displaySuccess("Performance test passed (< 10s)");
    } else {
      client.displayError("Performance test failed (> 10s)");
    }

    client.displaySeparator("Tool Tests Completed", "═");
    client.displaySuccess("All tool tests completed!");
    
  } catch (error) {
    client.displayError(`Tool test failed: ${error.message}`);
  } finally {
    await client.disconnect();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTools().catch(console.error);
} 
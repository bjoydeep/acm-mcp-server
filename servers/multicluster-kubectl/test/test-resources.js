#!/usr/bin/env node

import { ACMTestClient } from './test-client.js';

async function testResources() {
  console.log("🧪 Testing ACM MCP Resources...\n");
  
  const client = new ACMTestClient();
  
  try {
    // Connect to server
    const connected = await client.connect();
    if (!connected) {
      client.displayError("Failed to connect to server");
      return;
    }

    // Test 1: List all resources
    client.displaySeparator("Test 1: List All Resources");
    const resources = await client.listResources();
    
    if (resources.length === 0) {
      client.displayError("No resources found");
      return;
    }
    
    client.displaySuccess(`Found ${resources.length} resources`);
    resources.forEach((resource, index) => {
      console.log(`  ${index + 1}. ${resource.name}`);
      console.log(`     URI: ${resource.uri}`);
      console.log(`     Description: ${resource.description || 'N/A'}`);
      console.log(`     Type: ${resource.mimeType || 'N/A'}`);
      console.log();
    });

    // Test 2: Get specific resources and validate schema
    client.displaySeparator("Test 2: Get and Validate Resources");
    
    const testResources = [
      'acm://managedcluster',
      'acm://klusterlet', 
      'acm://clustermanager',
      'acm://manifestwork',
      'acm://placement'
    ];

    for (const resourceUri of testResources) {
      console.log(`\n📄 Testing resource: ${resourceUri}`);
      
      const resource = await client.getResource(resourceUri);
      
      if (!resource) {
        client.displayError(`Failed to get resource: ${resourceUri}`);
        continue;
      }

      if (!resource.contents || resource.contents.length === 0) {
        client.displayError(`No content found for resource: ${resourceUri}`);
        continue;
      }

      try {
        const content = resource.contents[0];
        const jsonData = JSON.parse(content.text);
        
        // Validate required fields
        const requiredFields = ['name', 'kind', 'apiVersion', 'description'];
        const missingFields = requiredFields.filter(field => !jsonData[field]);
        
        if (missingFields.length > 0) {
          client.displayError(`Missing required fields: ${missingFields.join(', ')}`);
        } else {
          client.displaySuccess(`Valid schema`);
          console.log(`    Name: ${jsonData.name}`);
          console.log(`    Kind: ${jsonData.kind}`);
          console.log(`    API Version: ${jsonData.apiVersion}`);
          console.log(`    Categories: ${jsonData.categories?.join(', ') || 'None'}`);
          console.log(`    Labels: ${jsonData.labels?.join(', ') || 'None'}`);
          
          // Validate schema structure
          if (jsonData.schema && typeof jsonData.schema === 'object') {
            client.displaySuccess(`Schema structure is valid`);
          } else {
            client.displayError(`Invalid schema structure`);
          }
        }
        
      } catch (error) {
        client.displayError(`Failed to parse JSON for ${resourceUri}: ${error.message}`);
      }
    }

    // Test 3: Test resource categories
    client.displaySeparator("Test 3: Test Resource Categories");
    
    const categoriesMap = new Map();
    
    for (const resource of resources) {
      const resourceData = await client.getResource(resource.uri);
      
      if (resourceData && resourceData.contents && resourceData.contents.length > 0) {
        try {
          const jsonData = JSON.parse(resourceData.contents[0].text);
          
          if (jsonData.categories && Array.isArray(jsonData.categories)) {
            jsonData.categories.forEach(category => {
              if (!categoriesMap.has(category)) {
                categoriesMap.set(category, []);
              }
              categoriesMap.get(category).push(jsonData.name);
            });
          }
        } catch (error) {
          // Skip malformed resources
        }
      }
    }

    client.displayInfo(`Found ${categoriesMap.size} categories:`);
    for (const [category, resourceNames] of categoriesMap) {
      console.log(`  📁 ${category}: ${resourceNames.length} resources`);
      resourceNames.forEach(name => {
        console.log(`    - ${name}`);
      });
      console.log();
    }

    // Test 4: Performance test
    client.displaySeparator("Test 4: Performance Test");
    
    const startTime = Date.now();
    
    const promises = resources.slice(0, 5).map(resource => 
      client.getResource(resource.uri)
    );
    
    const results = await Promise.all(promises);
    const successfulResults = results.filter(result => result !== null);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    client.displayInfo(`Fetched ${successfulResults.length}/${results.length} resources in ${duration}ms`);
    
    if (duration < 5000) {
      client.displaySuccess("Performance test passed (< 5s)");
    } else {
      client.displayError("Performance test failed (> 5s)");
    }

    client.displaySeparator("Resource Tests Completed", "═");
    client.displaySuccess("All resource tests completed!");
    
  } catch (error) {
    client.displayError(`Resource test failed: ${error.message}`);
  } finally {
    await client.disconnect();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testResources().catch(console.error);
} 
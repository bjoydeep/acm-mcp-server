# ACM MCP Test Suite

This directory contains comprehensive test scripts for the ACM MCP Server, testing both resources and tools functionality.

## 📁 Test Structure

```
test/
├── package.json          # Test client dependencies
├── test-client.js         # Base test client class
├── test-resources.js      # Resource-specific tests
├── test-tools.js          # Tool-specific tests
└── README.md             # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd test
npm install
```

### 2. Build the ACM MCP Server

```bash
cd ..
npm run build
```

### 3. Run Tests

```bash
cd test

# Run all tests
npm run test:all

# Or run specific tests
npm run test:resources    # Test resources only
npm run test:tools        # Test tools only
npm run test             # Run basic tests
```

## 🧪 Test Scripts

### Basic Tests (`test-client.js`)

Runs fundamental connectivity and listing tests:
- ✅ Server connection
- 📋 List available resources
- 🛠️ List available tools

```bash
node test-client.js
```

### Resource Tests (`test-resources.js`)

Comprehensive resource testing:
- 📄 List all resources
- 🔍 Validate resource schemas
- 📁 Test resource categories
- ⚡ Performance testing

**Test Coverage:**
- Schema validation (name, kind, apiVersion, description)
- Content parsing and structure validation
- Category organization
- Resource retrieval performance

```bash
node test-resources.js
```

### Tool Tests (`test-tools.js`)

Comprehensive tool testing:
- 🛠️ List all tools
- 📋 Test `clusters` tool
- 🔧 Test `kubectl` tool with various commands
- 🔗 Test `connect_cluster` tool
- ❌ Error handling validation
- ⚡ Performance testing

**Test Coverage:**
- Tool execution and response validation
- Parameter validation
- Error handling for invalid tools/parameters
- Performance benchmarking

```bash
node test-tools.js
```

## 📊 Expected Test Results

### Resources

The test should find and validate these resources:
- `acm://managedcluster` - Managed Cluster resource
- `acm://klusterlet` - Klusterlet agent resource  
- `acm://clustermanager` - Cluster Manager resource
- `acm://manifestwork` - Manifest Work resource
- `acm://placement` - Placement resource
- `acm://policy` - Policy resource
- `acm://addontemplate` - Add-on Template resource
- And more...

### Tools

The test should find and validate these tools:
- `clusters` - List managed clusters
- `kubectl` - Execute kubectl commands
- `connect_cluster` - Connect to managed clusters

### Categories

Resources should be organized in these categories:
- `OCM` - Open Cluster Management
- `Cluster` - Cluster management
- `AddOn` - Add-on management
- `Work` - Workload distribution
- `Authentication` - Authentication resources

## 🔧 Customization

### Adding New Tests

1. **For Resources**: Edit `test-resources.js`
   ```javascript
   // Add new test resources to the testResources array
   const testResources = [
     'acm://managedcluster',
     'acm://yournewresource'  // Add here
   ];
   ```

2. **For Tools**: Edit `test-tools.js`
   ```javascript
   // Add new tool tests in the main testTools function
   const newToolResult = await client.callTool('newtool', {
     param1: 'value1'
   });
   ```

### Modifying Test Thresholds

- **Performance**: Change timeout thresholds in the performance test sections
- **Validation**: Modify required fields in schema validation
- **Categories**: Update expected categories list

## 🏃‍♂️ Running Individual Tests

### Test Specific Resources

```bash
node -e "
import('./test-resources.js').then(async () => {
  const { ACMTestClient } = await import('./test-client.js');
  const client = new ACMTestClient();
  await client.connect();
  const resource = await client.getResource('acm://managedcluster');
  console.log(JSON.stringify(resource, null, 2));
  await client.disconnect();
});
"
```

### Test Specific Tools

```bash
node -e "
import('./test-tools.js').then(async () => {
  const { ACMTestClient } = await import('./test-client.js');
  const client = new ACMTestClient();
  await client.connect();
  const result = await client.callTool('clusters', {});
  console.log(result);
  await client.disconnect();
});
"
```

## 🔍 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure the ACM MCP server is built: `npm run build`
   - Check if the server builds without errors

2. **No Resources Found**
   - Verify schema files exist in `src/resources/schemas/`
   - Check that resource manager loads schemas correctly

3. **Tool Execution Failed**
   - Ensure `kubectl` is installed and accessible
   - Check Kubernetes cluster connectivity
   - Verify ACM is installed on the cluster

4. **Module Type Errors**
   - Ensure `"type": "module"` is in `test/package.json`
   - Use `.js` extensions in import statements

### Debug Mode

Add debug logging to any test:

```javascript
// Add this to any test file
console.log('Debug:', JSON.stringify(result, null, 2));
```

## 📝 Test Reports

Each test outputs:
- ✅ Success indicators
- ❌ Error messages with details
- ℹ️ Information and metrics
- 📊 Performance measurements

Example output:
```
✅ Connected to ACM MCP Server
✅ Found 18 resources
✅ Valid schema for acm://managedcluster
ℹ️  Fetched 5/5 resources in 234ms
✅ Performance test passed (< 5s)
```

## 🧩 Integration

These tests can be integrated into CI/CD pipelines:

```bash
# Exit on any test failure
set -e

# Run all tests
cd test
npm install
npm run test:all

echo "All tests passed!"
``` 
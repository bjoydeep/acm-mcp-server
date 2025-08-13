# ACM MCP SERVER

This repository provides a **Model Context Protocol (MCP) server** for **Red Hat Advanced Cluster Management (ACM)**. It exposes ACM resources and tools through the MCP interface, enabling AI agents to interact with ACM environments.

## 🌟 Features

### 📚 MCP Resources

The server provides **25 ACM resource schemas** with comprehensive metadata:

#### Core Resources
- **ManagedCluster** - Managed cluster registration and status
- **Klusterlet** - Klusterlet agent configuration
- **ClusterManager** - Hub cluster management
- **ManifestWork** - Workload deployment to managed clusters
- **Placement** - Cluster selection and placement policies

#### Policy & Governance
- **Policy** - Policy templates and compliance rules
- **PolicySet** - Policy grouping and management
- **PlacementBinding** - Policy-to-placement binding

#### Add-ons & Extensions
- **AddOnTemplate** - Add-on deployment templates
- **ManagedClusterAddOn** - Add-on instance management
- **ClusterManagementAddOn** - Global add-on configuration
- **ManagedServiceAccount** - Service account management

#### And More...
- **MultiClusterHub** - Hub installation and configuration
- **ManifestWorkReplicaSet** - Workload distribution
- **ManagedClusterSet** - Cluster grouping
- **PlacementDecision** - Placement results
- **ManagedClusterView** - Resource access control


Each resource includes:
- ✅ Complete JSON schema definition
- ✅ API version and kind information
- ✅ Detailed descriptions and usage hints
- ✅ Categorized organization (OCM, Cluster, AddOn, etc.)
- ✅ Labels and metadata

### 🛠️ MCP Tools

#### `clusters`
- List all managed clusters in the hub
- Display cluster status (joined, available, hub accepted)
- Show cluster ages and API endpoints

#### `kubectl`
- Execute kubectl commands securely
- Apply YAML configurations
- Support for both hub and managed cluster contexts
- Automatic kubeconfig management

#### `connect_cluster`
- Generate kubeconfig for managed clusters
- Create service accounts with specified cluster roles
- Automatic RBAC binding setup

## 🚀 Installation

### From NPM
```bash
npm install -g acm-mcp-server
```

### From Source
```bash
git clone https://github.com/your-org/acm-mcp-server.git
cd acm-mcp-server
npm install
npm run build
```

## 🔧 Configuration

### MCP Client Configuration

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "acm-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "acm-mcp-server@latest"
      ]
    }
  }
}
```

### Environment Setup

Set your kubeconfig to point to the ACM hub cluster:

```bash
export KUBECONFIG=/path/to/your/acm-hub-kubeconfig
```

## 📖 Usage Examples

### Accessing ACM Resources

```javascript
// List all available ACM resources
const resources = await client.listResources();

// Get specific resource schema
const managedCluster = await client.readResource({ 
  uri: "acm://managedcluster" 
});

// Access resource categories
const placement = await client.readResource({ 
  uri: "acm://placement" 
});
```

### Using ACM Tools

```javascript
// List managed clusters
const clusters = await client.callTool({
  name: "clusters",
  arguments: {}
});

// Execute kubectl commands
const pods = await client.callTool({
  name: "kubectl",
  arguments: {
    command: "kubectl get pods -n open-cluster-management"
  }
});

// Connect to a managed cluster
const connection = await client.callTool({
  name: "connect_cluster",
  arguments: {
    cluster: "my-managed-cluster",
    clusterRole: "cluster-admin"
  }
});
```

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Run all tests
cd test
npm install
npm run test:all

# Run resource tests only
npm run test:resources

# Run tool tests only
npm run test:tools
```

## 📂 Resource Categories

Resources are organized into logical categories:

- **OCM** (22 resources) - Open Cluster Management core
- **Cluster** (9 resources) - Cluster management
- **AddOn** (3 resources) - Add-on management
- **Policy** (3 resources) - Policy and governance
- **Work** (2 resources) - Workload distribution
- **Hub** (2 resources) - Hub components
- **Authentication** (1 resource) - Security and auth

## 🔗 Requirements

- Node.js 18+ 
- Access to ACM hub cluster
- kubectl CLI tool
- Valid kubeconfig for ACM hub

## 📄 License

ISC License
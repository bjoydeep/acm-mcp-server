# ACM MCP Servers - Proof of Concept

> ⚠️ **IMPORTANT DISCLAIMER**: This repository contains **proof-of-concept (POC)** implementations of Model Context Protocol (MCP) servers for Red Hat Advanced Cluster Management (ACM). These servers are **not intended for production use** and are provided for research, development, and demonstration purposes only.

A collection of Model Context Protocol (MCP) servers that enable AI assistants to interact with Red Hat Advanced Cluster Management (ACM) environments and related services.

## 📦 Included MCP Servers

### 1. ACM Multicluster-kubectl Server
- **Location**: `servers/multicluster-kubectl/`
- **Purpose**: Provides ACM cluster management capabilities and resource schemas
- **Key Features**: 25+ ACM resource schemas, cluster management tools, kubectl command execution

### 2. PostgreSQL MCP Server
- **Location**: `servers/postgresql/`
- **Purpose**: Provides secure database access for ACM search databases
- **Key Features**: SQL query execution, database schema introspection, multiple transport modes

### 3. GraphQL MCP Server
- **Location**: `servers/graphql/`
- **Purpose**: GraphQL endpoint integration (minimal implementation)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build servers
cd servers/multicluster-kubectl && npm run build
cd ../postgresql && npm run build

# Run ACM server
cd servers/multicluster-kubectl && npm run inspector

# Run PostgreSQL server
cd servers/postgresql && npm run dev
```

## 🧪 Testing

```bash
# Test ACM server
cd servers/multicluster-kubectl/test && npm run test:all

# Test PostgreSQL server
cd servers/postgresql && npm test
```

## ⚠️ Important Notes

- **This is a proof-of-concept implementation, not for production use**
- **Not officially supported by Red Hat**
- Requires valid kubeconfig pointing to ACM hub cluster
- Intended for development, testing, and demonstration purposes only

## 📄 License

ISC License

---

**Remember**: This is a proof-of-concept implementation. Use at your own risk and do not deploy in production environments.
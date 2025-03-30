# ACM MCP SERVER

This repository aims to build the **MCP server** for **Red Hat Advanced Cluster Management (ACM)**. It includes the following features:

### 🛠️ MCP Tools

#### Kubernetes Cluster Awareness (based on `kubectl`)

- ✅ Retrieve resources from the **hub cluster** (current context)  
- ✅ Retrieve resources from **managed clusters**  
- ✅ Connect to a **managed cluster** using a specified `ClusterRole`

#### ACM Search Integration (as an info tool or MCP resource provider)

- Embed **ACM Search** into the MCP server to enable message-based handling and routing

### 📦 Prompt Templates for ACM *(Planning)*

- Provide reusable prompt templates tailored for ACM tasks, streamlining agent interaction and automation

### 📚 MCP Resources for ACM *(Planning)*

- Reference official ACM documentation and related resources to support development and integration

### 🚀 How to Use

Configure the server using the following snippet:

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
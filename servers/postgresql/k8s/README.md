# OpenShift Deployment

## Quick Setup

1. **Login to OpenShift cluster**
   ```bash
   oc login https://your-cluster-url
   ```

2. **Run setup script from repository root**
   ```bash
   scripts/setup-proxy.sh
   ```

3. **Note the Client Token** - This will be displayed at the end of the setup and is needed for MCP client configuration.

## Configure MCP Client

Add to Claude Code:
```bash
claude mcp add --env NODE_TLS_REJECT_UNAUTHORIZED=0 --transport sse acm-search https://postgres-mcp-server-route-proxy-mcp-server.apps.$your-domain.com/sse --header "Authorization: Bearer YOUR_CLIENT_TOKEN_HERE"
```

Replace `YOUR_CLIENT_TOKEN_HERE` with the token from step 3. 
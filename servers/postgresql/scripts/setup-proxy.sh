#!/bin/bash

set -e

echo "=== Setting up MCP Server with Auth Proxy ==="

# Prerequisites (run these if starting fresh):
# git clone https://github.com/your-username/search-mcp-server.git
# cd search-mcp-server

# Check if we're logged into OpenShift
if ! oc whoami &>/dev/null; then
    echo "Error: Not logged into OpenShift. Please run 'oc login' first."
    exit 1
fi

# Check if namespace exists
NAMESPACE="mcp-server"
if ! oc get namespace "$NAMESPACE" &>/dev/null; then
    echo "Creating namespace: $NAMESPACE"
    oc create namespace "$NAMESPACE"
else
    echo "Namespace $NAMESPACE already exists"
fi

# Switch to namespace
echo "Switching to namespace: $NAMESPACE"
oc project "$NAMESPACE"

echo
echo "=== Setting up Database Secret ==="

# Check if secret already exists
if ! oc get secret postgres-mcp-secret &>/dev/null; then
    echo "Database secret not found. Creating it now..."
    if [ -f "scripts/create-secret.sh" ]; then
        ./scripts/create-secret.sh
        echo "Applying secret to cluster..."
        oc apply -f k8s/secret.yaml
    else
        echo "Error: Please create database secret manually."
        echo "Run: cp k8s/secret.yaml.template k8s/secret.yaml"
        echo "Then edit k8s/secret.yaml with your database URL and run: oc apply -f k8s/secret.yaml"
        exit 1
    fi
else
    echo "Database secret already exists"
fi

echo
echo "=== Building Main MCP Server Image ==="

# Create ImageStreams if they don't exist
echo "Setting up ImageStreams..."
oc apply -f k8s/imagestream-mcp-server.yaml
oc apply -f k8s/imagestream-auth-proxy.yaml

# Create binary build config if it doesn't exist
echo "Setting up MCP server build configuration..."
oc apply -f k8s/buildconfig-binary.yaml

# Build the main server image
echo "Building MCP server container..."
oc start-build postgres-mcp-server-binary --from-dir=. --follow

echo
echo "=== Building Auth Proxy Image ==="

# Create auth proxy build config if it doesn't exist
echo "Setting up auth proxy build configuration..."
oc apply -f k8s/buildconfig-auth-proxy.yaml

# Build auth proxy image
echo "Building auth proxy container..."

# Upload the auth proxy source
echo "Uploading auth proxy source..."
oc start-build auth-proxy --from-dir=./auth-proxy --follow

echo
echo "=== Deploying RBAC and Service Accounts ==="

# Apply RBAC
echo "Applying RBAC configuration..."
oc apply -f k8s/rbac_proxy.yaml

# Apply service accounts
echo "Applying service accounts..."
oc apply -f k8s/service-account_proxy.yaml

echo
echo "=== Deploying MCP Server with Auth Proxy ==="

# Apply deployment
echo "Applying deployment..."
oc apply -f k8s/deployment_proxy.yaml

# Wait for deployment
echo "Waiting for deployment to be ready..."
oc rollout status deployment/postgres-mcp-server-proxy --timeout=300s

echo
echo "=== Getting Access Information ==="

# Get the route URL
ROUTE_URL=$(oc get route postgres-mcp-server-route-proxy -o jsonpath='{.spec.host}')
if [ -n "$ROUTE_URL" ]; then
    echo "MCP Server URL: https://$ROUTE_URL"
    echo "SSE Endpoint: https://$ROUTE_URL/sse"
    echo
else
    echo "Warning: Could not get route URL"
fi

# Get client token
echo "Getting client token for Claude Code..."
if oc get secret mcp-client-proxy-token &>/dev/null; then
    CLIENT_TOKEN=$(oc get secret mcp-client-proxy-token -o jsonpath='{.data.token}' | base64 -d)
    echo "Client Token: $CLIENT_TOKEN"
    echo
else
    echo "Warning: Could not get client token"
fi

echo "=== Testing Auth Proxy ==="

if [ -n "$ROUTE_URL" ] && [ -n "$CLIENT_TOKEN" ]; then
    echo "Testing health endpoint (no auth)..."
    curl -s -k "https://$ROUTE_URL/health" || echo "Health check failed"
    echo
    
    echo "Testing authenticated endpoint..."
    curl -s -k -H "Authorization: Bearer $CLIENT_TOKEN" "https://$ROUTE_URL/info" || echo "Auth test failed"
    echo
    
    echo "Testing SSE endpoint..."
    curl -k -H "Authorization: Bearer $CLIENT_TOKEN" "https://$ROUTE_URL/sse" || echo "SSE test failed"
    echo
fi

echo
echo "=== Setup Complete ==="
echo "1. MCP Server with auth proxy is running"
echo "2. Use the client token above for authentication"
echo "3. Test with: curl -H 'Authorization: Bearer \$TOKEN' https://$ROUTE_URL/info"
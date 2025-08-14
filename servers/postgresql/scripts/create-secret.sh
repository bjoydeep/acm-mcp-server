#!/bin/bash

# Script to create the Kubernetes secret for the PostgreSQL MCP Server
# ACM-aware version that auto-discovers connection details from Red Hat ACM
# Falls back to generic input if ACM components are not found

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}PostgreSQL MCP Server - ACM-Aware Secret Generator${NC}"
echo "========================================================"

# Check if secret.yaml already exists
if [ -f "k8s/secret.yaml" ]; then
    echo -e "${YELLOW}Warning: k8s/secret.yaml already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo
echo -e "${BLUE}=== ACM Auto-Discovery ===${NC}"

# Try to auto-discover ACM PostgreSQL details
ACM_DISCOVERED=false
DB_HOST=""
DB_PORT="5432"
DB_NAME=""
DB_USER=""
DB_PASS=""

# Check if we can access the ACM search-postgres secret
if oc get secret search-postgres -n open-cluster-management &>/dev/null; then
    echo -e "${GREEN}Found ACM search-postgres secret! Extracting connection details...${NC}"
    
    # Extract database credentials from the secret
    if DB_USER=$(oc get secret search-postgres -n open-cluster-management -o jsonpath='{.data.database-user}' 2>/dev/null | base64 -d); then
        echo "✓ Found database user: $DB_USER"
    fi
    
    if DB_PASS=$(oc get secret search-postgres -n open-cluster-management -o jsonpath='{.data.database-password}' 2>/dev/null | base64 -d); then
        echo "✓ Found database password: [HIDDEN]"
    fi
    
    if DB_NAME=$(oc get secret search-postgres -n open-cluster-management -o jsonpath='{.data.database-name}' 2>/dev/null | base64 -d); then
        echo "✓ Found database name: $DB_NAME"
    fi
    
    # Try to find the PostgreSQL service/pod for hostname
    if oc get service search-postgres -n open-cluster-management &>/dev/null; then
        DB_HOST="search-postgres.open-cluster-management.svc.cluster.local"
        echo "✓ Found database service: $DB_HOST"
        ACM_DISCOVERED=true
    elif oc get pod -n open-cluster-management -l app=search-postgres &>/dev/null; then
        # Fallback to pod IP if service not found
        POD_IP=$(oc get pod -n open-cluster-management -l app=search-postgres -o jsonpath='{.items[0].status.podIP}' 2>/dev/null)
        if [ -n "$POD_IP" ]; then
            DB_HOST="$POD_IP"
            echo "✓ Found database pod IP: $DB_HOST"
            ACM_DISCOVERED=true
        fi
    fi
else
    echo -e "${YELLOW}ACM search-postgres secret not found in open-cluster-management namespace${NC}"
    echo "Falling back to manual input..."
fi

echo
if [ "$ACM_DISCOVERED" = true ]; then
    echo -e "${GREEN}=== ACM Connection Details Discovered ===${NC}"
    echo "Host: $DB_HOST"
    echo "Port: $DB_PORT"
    echo "Database: $DB_NAME"
    echo "User: $DB_USER"
    echo "Password: [HIDDEN]"
    echo
    read -p "Use these discovered values? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        ACM_DISCOVERED=false
        echo "Proceeding with manual input..."
    fi
fi

if [ "$ACM_DISCOVERED" = false ]; then
    echo -e "\n${GREEN}Enter your PostgreSQL connection details:${NC}"
    
    read -p "Database Host: " DB_HOST
    read -p "Database Port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Database Name: " DB_NAME
    read -p "Database Username: " DB_USER
    read -s -p "Database Password: " DB_PASS
    echo
fi

# Construct the database URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Base64 encode the database URL
ENCODED_URL=$(echo -n "$DATABASE_URL" | base64)

# Create the secret file
cat > k8s/secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-mcp-secret
  namespace: mcp-server
type: Opaque
data:
  # Base64 encoded database URL
  # Generated on: $(date)
  database-url: ${ENCODED_URL}
EOF

echo -e "\n${GREEN}Secret file created successfully!${NC}"
echo -e "File: ${YELLOW}k8s/secret.yaml${NC}"

if [ "$ACM_DISCOVERED" = true ]; then
    echo -e "\n${BLUE}✓ Used ACM auto-discovered connection details${NC}"
else
    echo -e "\n${YELLOW}⚠ Used manually entered connection details${NC}"
fi

echo -e "\n${GREEN}To apply the secret to your cluster:${NC}"
echo -e "  kubectl apply -f k8s/secret.yaml"
echo -e "\n${YELLOW}Remember:${NC}"
echo -e "  - The secret.yaml file is excluded from git (.gitignore)"
echo -e "  - Keep this file secure and don't commit it to version control"
echo -e "  - You can regenerate this file anytime using this script"
echo -e "  - For generic database setup, use: ./scripts/create-secret-generic.sh" 
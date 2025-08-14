FROM registry.access.redhat.com/ubi9/nodejs-18:latest

WORKDIR /app

# Switch to root for build operations
USER root

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Switch back to default user (non-root)
USER 1001

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/http-server.js"] 
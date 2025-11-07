# Use Node.js LTS version as the base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy source files and config
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Set default command to run the MCP server
CMD ["node", "build/index.js"] 
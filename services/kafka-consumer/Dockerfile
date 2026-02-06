FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY services/kafka-consumer/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy TypeScript config and source
COPY services/kafka-consumer/tsconfig.json ./
COPY services/kafka-consumer/src ./src

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Run the consumer service
CMD ["npm", "start"]

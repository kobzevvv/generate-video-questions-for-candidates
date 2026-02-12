FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directories
RUN mkdir -p data/jobs data/uploads data/outputs

# Expose port
EXPOSE 8080

# Start both server and worker
CMD ["sh", "-c", "node src/worker.js & node src/server.js"]

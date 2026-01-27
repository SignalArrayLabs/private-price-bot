# Dockerfile - packages the bot so it runs the same everywhere
# You don't need this to run the bot locally!

# Start with Node.js
FROM node:20-slim

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist/ ./dist/
COPY .env.example ./

# Create data directory for database
RUN mkdir -p data

# Run the bot
CMD ["node", "dist/index.js"]

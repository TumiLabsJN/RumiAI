FROM node:22-slim

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application files
COPY . .

# Copy service account credentials (CLI-free authentication)
COPY wif-credential.json /app/wif-credential.json

# Set environment variables for service account authentication
ENV GOOGLE_APPLICATION_CREDENTIALS="/app/wif-credential.json"

# Default command to run your analyzer script
CMD ["node", "analyze-tiktok-v2.js", "@username"]

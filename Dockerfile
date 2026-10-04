FROM node:23.11.0-slim

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./
# @lmna22/aio-downloader (only used by src/test.js) pulls in youtube-dl-exec, whose
# preinstall requires Python, and puppeteer, which downloads Chromium. The bot needs neither.
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1 PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install

# Copy the rest of the application
COPY . .

# Create directories for persistence
# RUN mkdir -p /app/data /app/downloads

# Build TypeScript
RUN npm run build

# Set environment variable to indicate Docker environment
ENV DOCKER=true

# Run the compiled JavaScript
CMD ["node", "dist/index.js"]
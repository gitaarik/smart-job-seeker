FROM node:22

# Install system dependencies required for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    libnspr4 \
    libnss3 \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libegl1 \
    libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

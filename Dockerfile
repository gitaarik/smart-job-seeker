FROM node:22-slim

# Prisma needs openssl, healthcheck needs curl, psql for database restore
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright Chromium + system dependencies for PDF generation
RUN npx playwright install --with-deps chromium

WORKDIR /app

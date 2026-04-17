FROM node:22-slim

# Prisma needs openssl, healthcheck needs curl, psql for database restore
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Patchright system dependencies for PDF generation (browser itself is
# installed at startup via start-app.sh to match the app's pinned version)
RUN npx patchright install-deps chromium

WORKDIR /app

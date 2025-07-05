#!/bin/bash
# Initialize Directus directories with proper permissions

# Create uploads directory if it doesn't exist
mkdir -p /directus/uploads

# Set permissions to 777
chmod 777 /directus/uploads

# Create extensions directory if it doesn't exist (already in compose, but for safety)
mkdir -p /directus/extensions

# Set permissions to 777
chmod 777 /directus/extensions

echo "Directus directories initialized successfully"

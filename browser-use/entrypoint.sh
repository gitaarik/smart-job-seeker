#!/bin/bash
set -e

# Install Playwright browsers if not installed
# This is needed for the scraper which launches Chrome directly
if [ ! -d "/root/.cache/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    playwright install chromium
fi

# Remove X lock file if exists
rm -f /tmp/.X99-lock

# Start Xvfb (virtual display)
Xvfb :99 -ac -screen 0 1920x1080x24 -nolisten tcp &
sleep 5

# Start x11vnc (VNC server)
x11vnc -display :99 \
       -rfbport 5900 \
       -listen 0.0.0.0 \
       -N -forever \
       -passwd secret \
       -shared &

# Start our FastAPI application
exec "$@"

FROM vovan/browser-use:latest

WORKDIR /app

# Install socat for port forwarding (Chrome binds to 127.0.0.1 even with --remote-debugging-address=0.0.0.0)
RUN apt-get update && apt-get install -y --no-install-recommends socat && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv and dependencies
COPY pyproject.toml .
RUN pip install uv && uv pip install --system .

# Copy application files
COPY . .

# Copy and set up custom entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use our custom entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command (can be overridden)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

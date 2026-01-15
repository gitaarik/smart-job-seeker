FROM vovan/browser-use:latest

WORKDIR /app

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

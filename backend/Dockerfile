FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for psycopg2, asyncpg, and psql client
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]

#!/bin/sh
# Create the database if it doesn't exist, then run migrations and start the app.
set -e

echo "[Pooly] Checking if database '$DB_NAME' exists on $DB_HOST:$DB_PORT..."

# Try to create the database (ignore error if it already exists)
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
     -c "CREATE DATABASE $DB_NAME" 2>/dev/null \
  || echo "[Pooly] Database may already exist or user lacks CREATE DATABASE privilege — continuing."

echo "[Pooly] Running migrations..."
alembic upgrade head

echo "[Pooly] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

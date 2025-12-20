#!/bin/bash
set -e

echo "Starting WhatsApp Bot Services..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until pg_isready -h localhost -p 5432 -U postgres; do
  sleep 1
done

echo "PostgreSQL is ready!"

# Wait for Redis to be ready
echo "Waiting for Redis..."
until redis-cli ping > /dev/null 2>&1; do
  sleep 1
done

echo "Redis is ready!"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Generate Prisma client
echo "Generating Prisma client..."
npm run prisma:generate -w apps/api

# Run migrations
echo "Running database migrations..."
npm run prisma:migrate -w apps/api

# Start API first in background
echo "Starting API server..."
cd /root/app-WhatsAppboot/apps/api
npm run dev > /tmp/api.log 2>&1 &
API_PID=$!

# Wait for API to be ready
echo "Waiting for API to be ready..."
MAX_WAIT=60
COUNTER=0
until curl -s http://localhost:4000/health > /dev/null 2>&1; do
  if [ $COUNTER -ge $MAX_WAIT ]; then
    echo "ERROR: API failed to start after ${MAX_WAIT} seconds"
    cat /tmp/api.log
    exit 1
  fi
  sleep 1
  COUNTER=$((COUNTER + 1))
done

echo "API health check passed! Waiting additional 5 seconds for full initialization..."
sleep 5

echo "API is fully ready! Starting Web server..."
cd /root/app-WhatsAppboot/apps/web
npm run dev > /tmp/web.log 2>&1 &
WEB_PID=$!

echo "Both servers started successfully!"
echo "API PID: $API_PID"
echo "Web PID: $WEB_PID"

# Wait for both processes
wait

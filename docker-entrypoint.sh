#!/bin/sh
set -e

# Apply pending database migrations before serving (idempotent; safe with replicas).
echo "Running database migrations…"
npx --workspace @ai-fluency/api prisma migrate deploy

echo "Starting API server…"
exec node apps/api/dist/server.js

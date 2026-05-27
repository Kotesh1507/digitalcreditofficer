#!/usr/bin/env bash
# Starts both backends and nginx reverse proxy inside the Docker container.
# CDO backend  → port 5000
# Insurance backend → port 5001
# Nginx        → port 80 (routes /insurance-socket, /insurance-api to 5001; rest to 5000)
set -euo pipefail

echo "[start.sh] Starting Digital Credit Officer backend on :5000..."
cd /app/backend
gunicorn --worker-class eventlet -w 1 --timeout 0 --bind 0.0.0.0:5000 app:app &

echo "[start.sh] Starting Insurance Underwriting Officer backend on :5001..."
cd /app/backend-insurance
gunicorn --worker-class threading -w 1 --timeout 0 --bind 0.0.0.0:5001 app:app &

echo "[start.sh] Starting nginx on :80..."
nginx -g "daemon off;" &

# Wait for any process to exit, then exit with its code
wait -n || true
echo "[start.sh] A process exited — container stopping."

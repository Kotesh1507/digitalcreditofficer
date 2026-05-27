#!/usr/bin/env bash
# Starts both Flask backends + nginx inside the Docker container.
#
# Port layout:
#   5002  →  CDO backend (Digital Credit Officer)
#   5003  →  Insurance backend (Underwriting Officer)
#   5000  →  nginx (public-facing — ALB routes to this port)
#
set -euo pipefail

echo "[start.sh] Starting Digital Credit Officer backend on :5002..."
cd /app/backend
gunicorn --worker-class eventlet -w 1 --timeout 0 --bind 0.0.0.0:5002 app:app &

echo "[start.sh] Starting Insurance Underwriting Officer backend on :5003..."
cd /app/backend-insurance
gunicorn --worker-class threading -w 1 --timeout 0 --bind 0.0.0.0:5003 app:app &

# Give backends 3s to start before nginx begins accepting traffic
sleep 3

echo "[start.sh] Starting nginx on :5000..."
nginx -g "daemon off;" &

# Wait — if any process dies, exit so ECS restarts the task
wait -n || true
echo "[start.sh] A process exited — container stopping."

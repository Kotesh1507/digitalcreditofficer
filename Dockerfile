# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Combined backends + nginx ────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install nginx
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*

# ── CDO backend deps ───────────────────────────────────────────────────────────
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# ── Insurance backend deps ────────────────────────────────────────────────────
COPY backend-insurance/requirements.txt /app/backend-insurance/requirements.txt
RUN pip install --no-cache-dir -r /app/backend-insurance/requirements.txt

# ── Copy backend source ────────────────────────────────────────────────────────
COPY backend/ /app/backend/
COPY backend-insurance/ /app/backend-insurance/

# ── React build → CDO backend static folder (Flask serves SPA) ───────────────
COPY --from=frontend /frontend/dist /app/backend/static

# ── nginx config ──────────────────────────────────────────────────────────────
COPY nginx.conf /etc/nginx/nginx.conf

# ── Startup script ────────────────────────────────────────────────────────────
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Port 5000 — matches ALB target group + ECS task definition
EXPOSE 5000

CMD ["/app/start.sh"]

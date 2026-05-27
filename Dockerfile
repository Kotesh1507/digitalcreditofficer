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

# ── Install CDO backend deps ───────────────────────────────────────────────────
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# ── Install Insurance backend deps ────────────────────────────────────────────
COPY backend-insurance/requirements.txt /app/backend-insurance/requirements.txt
RUN pip install --no-cache-dir -r /app/backend-insurance/requirements.txt

# ── Copy backend source ────────────────────────────────────────────────────────
COPY backend/ /app/backend/
COPY backend-insurance/ /app/backend-insurance/

# ── Embed built frontend as static files served by CDO backend ────────────────
COPY --from=frontend /frontend/dist /app/backend/static

# ── nginx config ──────────────────────────────────────────────────────────────
COPY nginx.conf /etc/nginx/nginx.conf

# ── Startup script ────────────────────────────────────────────────────────────
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose single port — nginx routes traffic internally
EXPOSE 80

CMD ["/app/start.sh"]

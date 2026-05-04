# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + bundled React ────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend /frontend/dist ./static
EXPOSE 5000
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--timeout", "0", "--bind", "0.0.0.0:5000", "app:app"]

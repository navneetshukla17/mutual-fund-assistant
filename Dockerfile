# Stage 1: Build Frontend Assets
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    PYTHONPATH=/app

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user (Hugging Face Spaces default UID is 1000)
RUN useradd -m -u 1000 user

# Copy application files
COPY . /app

# Ensure latest compiled frontend assets are in place
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

# Grant ownership to user 1000 so ChromaDB SQLite can manage locks and WAL
RUN chown -R user:user /app

USER user

EXPOSE 7860

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

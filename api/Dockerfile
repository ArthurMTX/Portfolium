FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including WeasyPrint requirements
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    libwebp-dev \
    libjpeg-dev \
    libpng-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY api/pyproject.toml ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Copy application
COPY api/ .

# Copy translation files from web directory (needed for email translations)
COPY web/src/locales ./locales

# Create static directory and copy logo for email templates
RUN mkdir -p ./static
COPY web/public/favicon-96x96.png ./static/logo.png

# Copy email templates
COPY api/app/templates ./app/templates

# Expose port
EXPOSE 8000

# Run application with uvicorn (single worker for dev, use gunicorn for production)
# --timeout-keep-alive handles slow clients, --backlog for connection queue
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "30", "--backlog", "100"]

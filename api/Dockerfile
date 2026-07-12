FROM python:3.11-slim

WORKDIR /app

ARG INSTALL_DEV=false

# Install system dependencies including WeasyPrint requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    if [ "$INSTALL_DEV" = "true" ]; then \
        pip install --no-cache-dir -e ".[dev]"; \
    else \
        pip install --no-cache-dir -e .; \
    fi

# Copy application
COPY api/ .

# Copy translation files from web directory (needed for email translations)
COPY web/src/locales ./locales

# Create static directory and copy logo for email templates
RUN mkdir -p ./static /tmp/prometheus-multiproc
COPY web/public/favicon-96x96.png ./static/logo.png

# Copy email templates
COPY api/app/templates ./app/templates

# Runtime processes do not need root. Keep writable runtime paths outside the
# source tree so production and bind-mounted development both work.
RUN groupadd --system --gid 10001 portfolium && \
    useradd --system --uid 10001 --gid portfolium --create-home portfolium && \
    mkdir -p /tmp/portfolium /home/portfolium/.cache/portfolium && \
    chown -R portfolium:portfolium /app /tmp/prometheus-multiproc /tmp/portfolium /home/portfolium

USER portfolium

# Expose port
EXPOSE 8000

# Run application with uvicorn
# --timeout-keep-alive handles slow clients, --backlog for connection queue
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "30", "--backlog", "100", "--no-access-log"]

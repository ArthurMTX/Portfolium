# Custom PostgreSQL image with initialization scripts
FROM postgres:15-alpine

# Copy database initialization scripts
COPY init/*.sql /docker-entrypoint-initdb.d/

# Set proper permissions
RUN chmod -R 755 /docker-entrypoint-initdb.d/

# Metadata
LABEL maintainer="ArthurMTX"
LABEL description="PostgreSQL database for Portfolium with embedded migrations"

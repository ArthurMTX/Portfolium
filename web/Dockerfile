FROM node:18-alpine AS development

WORKDIR /app

# Install Python and MkDocs for building documentation
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir mkdocs mkdocs-material pymdown-extensions --break-system-packages

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY web/ .

# Copy documentation files
COPY mkdocs.yml /docs/
COPY docs /docs/docs

# Build documentation into public/docs
RUN cd /docs && mkdocs build -d /app/public/docs

# Expose dev server port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host"]

# Production build stage
FROM node:18-alpine AS build

WORKDIR /app

# Install Python and MkDocs for building documentation
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir mkdocs mkdocs-material pymdown-extensions --break-system-packages

# Copy package files and install dependencies
COPY web/package*.json ./
RUN npm ci

# Copy web source
COPY web/ .

# Copy documentation files
COPY mkdocs.yml /build/
COPY docs /build/docs

# Build documentation into public/docs
RUN cd /build && mkdocs build -d /app/public/docs

# Build the web app (skip docs build since we just built it above)
RUN tsc && npx vite build

# Production serve stage
FROM nginx:alpine AS production

# Copy web app (includes docs)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

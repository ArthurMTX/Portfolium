# Reverse Proxy & HTTPS

Portfolium's production `web` container serves plain HTTP on port $80$ (see `docker-compose.yml`) and expects TLS termination to happen in front of it. This guide covers putting a reverse proxy in front for HTTPS.

## Why You Need This

Running Portfolium directly on port 80 without HTTPS exposes login credentials, session tokens, and financial data in plaintext over the network. Any real deployment reachable outside `localhost` should sit behind a reverse proxy terminating TLS.

## What's Already Handled Internally

The bundled nginx config inside the `web` container (`web/nginx.conf`) already sets security headers on every response — `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. Your reverse proxy doesn't need to duplicate these; it just needs to handle TLS and forward traffic to the `web` container's port 80.

## Example: Caddy

Caddy is the simplest option — automatic HTTPS via Let's Encrypt with a couple of lines:

```caddyfile
portfolium.example.com {
    reverse_proxy localhost:80
}
```

## Example: Traefik

If you already run Traefik for other services, add labels to the `web` service in `docker-compose.yml`:

```yaml
services:
  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portfolium.rule=Host(`portfolium.example.com`)"
      - "traefik.http.routers.portfolium.entrypoints=websecure"
      - "traefik.http.routers.portfolium.tls.certresolver=letsencrypt"
      - "traefik.http.services.portfolium.loadbalancer.server.port=80"
```

## Example: nginx (external)

```nginx
server {
    listen 443 ssl;
    server_name portfolium.example.com;

    ssl_certificate     /etc/letsencrypt/live/portfolium.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portfolium.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

!!! warning "Don't expose port 80 to the internet unproxied"
    If you bind `80:80` directly on a public interface without a reverse proxy in front, traffic (including login credentials) travels unencrypted. Bind to `127.0.0.1:80` instead and let your reverse proxy handle the public-facing port.

## WebSocket / Real-Time Considerations

If your reverse proxy doesn't forward WebSocket upgrade headers by default, make sure `Upgrade` and `Connection` headers are passed through — check your proxy's documentation, as this varies (Caddy and Traefik handle it automatically; a hand-rolled nginx config needs explicit `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";`).

## Related

- [Installation](../getting-started/installation.md) — base Docker Compose setup
- [Configuration](../getting-started/configuration.md) — environment variables, including any URL/origin settings that must match your public domain
- [Troubleshooting](troubleshooting.md) — diagnosing connectivity issues once behind a proxy

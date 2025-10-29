# Configuration

Learn how to configure Portfolium for your needs.

## Environment Variables

All configuration is done through environment variables in the `.env` file.

### Database Settings

```env
POSTGRES_DB=portfolium
POSTGRES_USER=portfolium
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `portfolium` |
| `POSTGRES_USER` | Database user | `portfolium` |
| `POSTGRES_PASSWORD` | Database password | `portfolium` |
| `POSTGRES_HOST` | Database host | `db` |
| `POSTGRES_PORT` | Database port | `5432` |

### Admin User

The admin user is automatically created on first startup if `ADMIN_AUTO_CREATE=true`.

```env
ADMIN_AUTO_CREATE=true
ADMIN_EMAIL=admin@portfolium.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Administrator
ADMIN_IS_ACTIVE=true
ADMIN_IS_VERIFIED=true
```

!!! warning "Change Default Credentials"
    Always change the default admin password in production!

### Security

```env
SECRET_KEY=your-secret-key-change-this-in-production-min-32-chars
```

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | JWT signing key (min 32 chars) | Yes |

!!! danger "Secret Key Security"
    Generate a strong random secret key for production. Never commit it to version control!

### API Configuration

```env
API_HOST=0.0.0.0
API_PORT=8000
API_KEY=dev-key-12345
PRICE_CACHE_TTL_SECONDS=300
```

| Variable | Description | Default |
|----------|-------------|---------|
| `API_HOST` | API bind host | `0.0.0.0` |
| `API_PORT` | API port | `8000` |
| `API_KEY` | Internal API key | - |
| `PRICE_CACHE_TTL_SECONDS` | Price cache duration | `300` |

### Email Configuration

Enable email notifications and password resets:

```env
ENABLE_EMAIL=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@example.com
FROM_NAME=Portfolium
```

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_EMAIL` | Enable email features | `false` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password/app password | - |
| `FROM_EMAIL` | Sender email address | `noreply@example.com` |
| `FROM_NAME` | Sender name | `Portfolium` |

!!! tip "Gmail App Passwords"
    For Gmail, create an [App Password](https://support.google.com/accounts/answer/185833) instead of using your account password.

### External APIs

```env
BRANDFETCH_API_KEY=your_brandfetch_key
```

| Variable | Description | Required |
|----------|-------------|----------|
| `BRANDFETCH_API_KEY` | Brandfetch API key for company logos | No |

### Frontend

```env
VITE_API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |
| `FRONTEND_URL` | Frontend URL (for emails) | `http://localhost:5173` |

## Application Settings

Configure application behavior through the Settings page in the UI:

### Price Updates

- **Auto-refresh interval**: Set how often prices update
- **Market hours only**: Only update during market hours

### Notifications

- **Daily summaries**: Receive daily portfolio reports
- **Price alerts**: Get notified of significant price changes
- **Transaction confirmations**: Email confirmations for transactions

### Display Preferences

- **Currency**: Display currency (USD, EUR, etc.)
- **Date format**: Preferred date format
- **Theme**: Light or dark mode

## Advanced Configuration

### Nginx Configuration

For production deployments, customize `web/nginx.conf`:

```nginx
# Caching settings
proxy_cache_path /var/cache/nginx/brandfetch 
  levels=1:2 
  keys_zone=brandfetch_cache:10m 
  max_size=200m 
  inactive=30d;

# SSL configuration
listen 443 ssl http2;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

### Database Tuning

For large portfolios, optimize PostgreSQL in `docker-compose.yml`:

```yaml
command: postgres -c shared_buffers=256MB -c max_connections=200
```

## Next Steps

- [Deploy to Production](../deployment/docker.md)
- [Environment Variables Reference](../deployment/environment.md)
- [API Configuration](../api/overview.md)

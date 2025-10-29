# API Overview

Portfolium provides a comprehensive REST API built with FastAPI, enabling programmatic access to all features.

## Base URL

```
http://localhost:8000
```

For production, use your deployed API URL.

## Authentication

Portfolium uses JWT (JSON Web Tokens) for authentication.

### Obtaining a Token

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "your_username",
    "email": "your@email.com",
    "full_name": "Your Name",
    "is_active": true,
    "is_admin": false
  }
}
```

### Using the Token

Include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Interactive Documentation

Portfolium includes auto-generated interactive API documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## API Endpoints

### Health Check

```http
GET /health
```

Returns API health status.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get token |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update current user |
| DELETE | `/users/me` | Delete account |

### Portfolios

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios` | List all portfolios |
| POST | `/portfolios` | Create portfolio |
| GET | `/portfolios/{id}` | Get portfolio details |
| PUT | `/portfolios/{id}` | Update portfolio |
| DELETE | `/portfolios/{id}` | Delete portfolio |
| GET | `/portfolios/{id}/value` | Get current value |
| GET | `/portfolios/{id}/history` | Get historical values |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/transactions` | List transactions |
| POST | `/portfolios/{id}/transactions` | Add transaction |
| PUT | `/transactions/{id}` | Update transaction |
| DELETE | `/transactions/{id}` | Delete transaction |
| POST | `/transactions/import` | Bulk import from CSV |

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | Search assets |
| GET | `/assets/{symbol}` | Get asset details |
| GET | `/assets/{symbol}/price` | Get current price |
| GET | `/assets/{symbol}/history` | Get price history |
| GET | `/assets/logo/{symbol}` | Get asset logo |

### Watchlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watchlist` | Get watchlist |
| POST | `/watchlist` | Add to watchlist |
| DELETE | `/watchlist/{symbol}` | Remove from watchlist |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/{id}/read` | Mark as read |
| DELETE | `/notifications/{id}` | Delete notification |

### Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/insights/portfolio/{id}` | Get portfolio insights |
| GET | `/insights/performance` | Get performance metrics |

## Rate Limiting

Currently, no rate limiting is enforced. In production, consider implementing rate limiting for security.

## Error Handling

The API uses standard HTTP status codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

**Error Response Format**:
```json
{
  "detail": "Error message describing what went wrong"
}
```

## Pagination

List endpoints support pagination with query parameters:

```
?skip=0&limit=100
```

## Examples

See [Authentication](authentication.md) and [Endpoints](endpoints.md) for detailed examples.

## WebSocket Support

(Coming soon) Real-time price updates via WebSocket connections.

## Next Steps

- [Authentication Guide](authentication.md)
- [Endpoint Reference](endpoints.md)
- [API Integration Examples](endpoints.md#examples)

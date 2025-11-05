# Technical Reference Overview

This section provides detailed technical documentation about Portfolium's core systems and algorithms.

## Purpose

The Technical Reference is designed for:

- **Developers** working on the codebase
- **Contributors** understanding implementation details
- **Advanced users** wanting to know how things work under the hood
- **System administrators** troubleshooting issues

## Topics Covered

### [Stock Splits](stock-splits.md)

Learn how Portfolium handles stock split transactions, including:

- Split ratio parsing and validation
- Position quantity adjustments
- Cost basis preservation
- Historical accuracy maintenance

### [Logo Fetching](logo-fetching.md)

Understand the logo resolution system:

- Multi-strategy logo fetching (Brandfetch API)
- Image validation and optimization
- Caching mechanisms
- Fallback SVG generation

### [Price Fetching](price-fetching.md)

Deep dive into price data management:

- Yahoo Finance integration (yfinance)
- Price caching with TTL
- Daily change percentage calculation
- Concurrent price updates
- Historical price backfilling

### [Currency Conversion](currency-conversion.md)

Currency handling and conversion:

- Exchange rate fetching from Yahoo Finance
- Rate caching strategy
- Multi-currency portfolio support
- Conversion accuracy

### [Data Models](data-models.md)

Complete database schema and ORM models:

- SQLAlchemy models (User, Portfolio, Asset, Transaction, Price)
- Pydantic schemas for validation
- Relationships and constraints
- Enumerations and types

### [Pricing Service](pricing-service.md)

Architecture of the pricing subsystem:

- Service class design
- Async/await patterns for performance
- Error handling strategies
- Cache invalidation logic

### [Asset Metadata Overrides](asset-metadata-overrides.md)

User-specific asset classification system:

- Custom sector, industry, and country assignments
- User-specific overrides (each user can set their own)
- Fallback-only design (only when Yahoo Finance has no data)
- Automatic integration with distributions and insights
- Database table for override storage

## Technology Stack

### Backend

- **Framework**: FastAPI (Python 3.11+)
- **ORM**: SQLAlchemy 2.0
- **Database**: PostgreSQL 14+
- **Validation**: Pydantic v2
- **Data Sources**: yfinance, Brandfetch API
- **Async Tasks**: APScheduler
- **Migration Tool**: Alembic

### Frontend

- **Framework**: React 18 with TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Build Tool**: Vite

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **Database Schema**: `portfolio` schema in PostgreSQL
- **API Documentation**: OpenAPI/Swagger (auto-generated)

## Code Organization

```
api/
├── app/
│   ├── models.py          # SQLAlchemy ORM models
│   ├── schemas.py         # Pydantic validation schemas
│   ├── crud/              # CRUD operations
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   │   ├── pricing.py     # Price fetching service
│   │   ├── logos.py       # Logo fetching service
│   │   ├── currency.py    # Currency conversion
│   │   ├── metrics.py     # Portfolio calculations
│   │   └── insights.py    # Analytics engine
│   └── tasks/             # Background jobs
│       └── scheduler.py   # APScheduler tasks
```

## Design Principles

### 1. Separation of Concerns

- **Routers**: Handle HTTP requests/responses
- **CRUD**: Database operations
- **Services**: Business logic and external integrations
- **Models**: Data structure definitions
- **Schemas**: Input/output validation

### 2. Async-First

- Use `async/await` for I/O-bound operations
- Concurrent API calls with `asyncio.gather()`
- Non-blocking database queries where beneficial
- Background task processing with APScheduler

### 3. Caching Strategy

- **Price data**: TTL-based caching in database
- **Logo data**: Persistent storage in `asset.logo_data`
- **Exchange rates**: In-memory cache with 1-hour TTL
- **Portfolio metrics**: 5-minute in-memory cache

### 4. Data Integrity

- **Transaction validation**: Prevent overselling (configurable)
- **Referential integrity**: Foreign key constraints
- **Type safety**: Pydantic schemas + SQLAlchemy types
- **Enum validation**: Python enums for controlled values

### 5. Error Handling

- **Graceful degradation**: Fallback to cached data on API failures
- **Detailed logging**: Structured logging with context
- **User-friendly errors**: Clear HTTP status codes and messages
- **Retry logic**: For transient failures (rate limits, network)

## Performance Optimizations

### Database

- **Indexes**: On foreign keys, symbols, dates
- **Query optimization**: Select only needed columns
- **Batch operations**: Bulk inserts for imports
- **Connection pooling**: SQLAlchemy engine configuration

### API

- **Concurrent requests**: Multiple price fetches in parallel
- **Response caching**: ETags and cache headers
- **Pagination**: Limit result sets
- **Lazy loading**: Load data only when needed

### Frontend

- **Code splitting**: Route-based lazy loading
- **Image optimization**: WebP logos, lazy loading
- **Virtual scrolling**: For large transaction lists
- **Debouncing**: Search inputs and auto-refresh

## Security Considerations

### Authentication

- **JWT tokens**: Secure, stateless authentication
- **Password hashing**: bcrypt with salt
- **Token expiration**: 7-day default, configurable
- **Email verification**: Required for activation

### Authorization

- **User isolation**: Users only see their own data
- **Portfolio ownership**: Verified on every request
- **Admin permissions**: Separate superuser flag
- **API key protection**: Environment variable storage

### Data Protection

- **SQL injection prevention**: SQLAlchemy ORM (parameterized queries)
- **CORS configuration**: Whitelist allowed origins
- **Input validation**: Pydantic schemas on all inputs
- **Rate limiting**: Planned (not yet implemented)

## External Dependencies

### Yahoo Finance (yfinance)

- **Purpose**: Stock/crypto prices and historical data
- **Rate Limits**: Approximately 2,000 requests/hour (informal)
- **Reliability**: Generally reliable, occasional outages
- **Alternatives**: Alpha Vantage, IEX Cloud (not implemented)

### Brandfetch API

- **Purpose**: Company logos
- **Rate Limits**: Depends on plan (free tier available)
- **Fallback**: SVG generation with ticker letters
- **Optional**: Works without API key (limited results)

## Testing Strategy

### Unit Tests

- **CRUD operations**: Test database interactions
- **Service logic**: Test business rules (splits, metrics)
- **Schema validation**: Test Pydantic models
- **Utility functions**: Test parsers, converters

### Integration Tests

- **API endpoints**: Test full request/response cycle
- **Database transactions**: Test rollback behavior
- **External APIs**: Mock yfinance and Brandfetch
- **Price calculations**: Test portfolio metrics accuracy

### Test Coverage

- Run tests: `pytest tests/ -v`
- Coverage report: `pytest --cov=app tests/`
- Test fixtures: Shared test data in `conftest.py`

## Debugging Tips

### Backend

- **Enable debug logs**: Set `LOG_LEVEL=DEBUG` in `.env`
- **Check logs**: `docker compose logs api -f`
- **Interactive shell**: `docker compose exec api python`
- **Database inspection**: Use pgAdmin or psql

### Frontend

- **React DevTools**: Inspect component state
- **Network tab**: Monitor API requests
- **Console errors**: Check browser console
- **Zustand DevTools**: State management debugging

### Common Issues

- **Price fetch failures**: Check rate limits, verify symbol
- **Logo not appearing**: Check Brandfetch API key, fallback SVG
- **Incorrect metrics**: Verify transaction dates, check for missing splits
- **Performance**: Check database indexes, analyze slow queries

## Contributing

See [Contributing Guide](../development/contributing.md) for:

- Code style guidelines
- Pull request process
- Development setup
- Testing requirements

## Next Steps

Dive into specific technical topics:

- [Stock Splits](stock-splits.md) - Learn split handling
- [Logo Fetching](logo-fetching.md) - Understand logo system
- [Price Fetching](price-fetching.md) - Explore price management
- [Currency Conversion](currency-conversion.md) - Multi-currency support
- [Data Models](data-models.md) - Database schema
- [Pricing Service](pricing-service.md) - Service architecture
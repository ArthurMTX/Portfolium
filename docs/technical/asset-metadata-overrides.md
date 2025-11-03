# Asset Metadata Overrides

## Overview

Asset Metadata Overrides allow users to set custom sector, industry, and country classifications for assets when Yahoo Finance doesn't provide this information. **Overrides are user-specific** - each user can have their own classification preferences for the same asset.

## Purpose

Many ETFs and certain assets from Yahoo Finance don't have:
- `sector` (e.g., "Technology", "Healthcare")
- `industry` (e.g., "Software", "Biotechnology")
- `country` (e.g., "US", "GB")

This feature allows users to manually classify these assets, ensuring:
- Complete distribution charts (sectors, industries, countries)
- Accurate portfolio insights and analytics
- Personalized asset categorization
- User autonomy in classification decisions

## User-Specific Design

### Why User-Specific?

Different users may have different opinions about how to classify assets:

- **User A** might classify a global ETF as "US" (based on domicile)
- **User B** might classify the same ETF as "Global" (based on holdings)
- **User C** might classify a fintech company as "Technology"
- **User D** might classify the same company as "Financials"

Each user can set their own preferences without affecting other users.

### Example Scenario

```
Asset: ARK Innovation ETF (ARKK)
Yahoo Finance: sector=NULL, industry=NULL, country=NULL

User 1's Overrides:
  - sector: "Technology"
  - industry: "Software"
  - country: "US"

User 2's Overrides:
  - sector: "Financials"
  - industry: "Asset Management"
  - country: "US"

Result:
- User 1 sees ARKK as Technology/Software/US
- User 2 sees ARKK as Financials/Asset Management/US
- Other users see ARKK with no sector/industry/country
```

## Fallback-Only Design

Overrides are **only allowed when Yahoo Finance has no data**:

```
✅ Allowed:
   Yahoo Finance: sector=NULL
   User sets: sector="Technology"

❌ Blocked:
   Yahoo Finance: sector="Healthcare"
   User tries to set: sector="Technology"
   Error: "Cannot override existing Yahoo Finance data"
```

This ensures data integrity and prevents users from accidentally hiding real data from Yahoo Finance.

## Database Schema

### Table: `asset_metadata_overrides`

```sql
CREATE TABLE portfolio.asset_metadata_overrides (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES portfolio.users(id) ON DELETE CASCADE,
    asset_id INTEGER NOT NULL REFERENCES portfolio.assets(id) ON DELETE CASCADE,
    sector_override VARCHAR(100),
    industry_override VARCHAR(100),
    country_override VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asset_id)
);

CREATE INDEX idx_metadata_overrides_user ON portfolio.asset_metadata_overrides(user_id);
CREATE INDEX idx_metadata_overrides_asset ON portfolio.asset_metadata_overrides(asset_id);
```

### Relationships

- **user_id** → `users.id`: Each override belongs to a specific user
- **asset_id** → `assets.id`: Each override applies to a specific asset
- **Unique constraint**: One override record per (user, asset) pair
- **Cascade delete**: Deleting user or asset removes associated overrides

## API Endpoints

### Set User-Specific Overrides

**Endpoint**: `PATCH /assets/{asset_id}/metadata-overrides`

**Authentication**: Required (JWT token)

**Request Body**:
```json
{
  "sector_override": "Technology",
  "industry_override": "Software",
  "country_override": "US"
}
```

**Validation Rules**:
1. Can only set overrides for NULL fields in Yahoo Finance data
2. All fields are optional (can set any combination)
3. Country must be valid 2-letter code (if provided)
4. Overrides apply only to the authenticated user

**Response** (200 OK):
```json
{
  "id": 1,
  "user_id": 5,
  "asset_id": 123,
  "sector_override": "Technology",
  "industry_override": "Software",
  "country_override": "US",
  "created_at": "2025-11-03T14:00:00Z",
  "updated_at": "2025-11-03T14:00:00Z"
}
```

**Error Responses**:

- **400 Bad Request**: Attempting to override existing Yahoo Finance data
  ```json
  {
    "detail": "Cannot override 'sector': Yahoo Finance already provides data (Healthcare)"
  }
  ```

- **404 Not Found**: Asset doesn't exist
  ```json
  {
    "detail": "Asset not found"
  }
  ```

### Get Assets with Effective Metadata

**Endpoint**: `GET /assets/held/all`

**Authentication**: Required (JWT token)

**Query Parameters**:
- `portfolio_id` (optional): Filter by portfolio

**Response**:
```json
[
  {
    "id": 123,
    "symbol": "ARKK",
    "name": "ARK Innovation ETF",
    "asset_type": "ETF",
    "sector": null,
    "industry": null,
    "country": null,
    "effective_sector": "Technology",
    "effective_industry": "Software",
    "effective_country": "US"
  }
]
```

**Field Meanings**:
- `sector`, `industry`, `country`: Original Yahoo Finance data (may be NULL)
- `effective_sector`, `effective_industry`, `effective_country`: Yahoo Finance data if present, otherwise user's override

## Automatic Integration

### Distribution Endpoints

All distribution endpoints automatically use effective values (including user overrides):

- **GET /assets/distribution/sectors**
  ```json
  {
    "Technology": 45000.50,
    "Healthcare": 30000.00
  }
  ```
  ✅ Includes assets with user-specified sector overrides

- **GET /assets/distribution/industries**
  ```json
  {
    "Software": 25000.00,
    "Biotechnology": 15000.00
  }
  ```
  ✅ Includes assets with user-specified industry overrides

- **GET /assets/distribution/countries**
  ```json
  {
    "US": 60000.00,
    "GB": 15000.00
  }
  ```
  ✅ Includes assets with user-specified country overrides

### Insights Service

Portfolio insights automatically use user-specific overrides:

- **Sector Allocation**: Uses `effective_sector` per user
- **Geographic Allocation**: Uses `effective_country` per user
- **Industry Breakdown**: Uses `effective_industry` per user

Example:
```python
# User 1 requests insights
GET /portfolios/1/insights
# Returns sector allocation based on User 1's overrides

# User 2 requests insights for the same portfolio (if shared)
GET /portfolios/1/insights
# Returns sector allocation based on User 2's overrides
```

## Implementation Details

### CRUD Functions

**`crud.assets.get_user_asset_override(db, user_id, asset_id)`**

Fetches a user's override record for a specific asset.

```python
override = await crud.assets.get_user_asset_override(
    db=db,
    user_id=current_user.id,
    asset_id=asset_id
)
# Returns AssetMetadataOverride or None
```

**`crud.assets.set_asset_metadata_overrides(db, user_id, asset_id, overrides)`**

Creates or updates a user's override record with validation.

```python
result = await crud.assets.set_asset_metadata_overrides(
    db=db,
    user_id=current_user.id,
    asset_id=asset_id,
    overrides=AssetMetadataOverride(
        sector_override="Technology",
        industry_override="Software",
        country_override="US"
    )
)
# Returns AssetMetadataOverride on success
# Raises HTTPException(400) if validation fails
```

**Validation Logic**:
1. Fetch the asset from database
2. For each override field (sector, industry, country):
   - If override value is provided
   - Check if Yahoo Finance already has data for that field
   - If yes: Raise error with field name and existing value
   - If no: Allow the override
3. Create or update the override record

**`crud.assets.get_effective_asset_metadata(db, asset_id, user_id)`**

Returns effective metadata (Yahoo Finance + user overrides).

```python
effective = await crud.assets.get_effective_asset_metadata(
    db=db,
    asset_id=asset_id,
    user_id=current_user.id
)
# Returns:
# {
#     "sector": "Technology",     # Yahoo Finance if present, else override
#     "industry": "Software",     # Yahoo Finance if present, else override
#     "country": "US"             # Yahoo Finance if present, else override
# }
```

**Priority Logic**:
```python
effective_sector = asset.sector or override.sector_override
effective_industry = asset.industry or override.industry_override
effective_country = asset.country or override.country_override
```

### SQLAlchemy Model

```python
class AssetMetadataOverride(Base):
    __tablename__ = "asset_metadata_overrides"
    __table_args__ = {"schema": "portfolio"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("portfolio.users.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("portfolio.assets.id", ondelete="CASCADE"), nullable=False)
    sector_override = Column(String(100), nullable=True)
    industry_override = Column(String(100), nullable=True)
    country_override = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="asset_metadata_overrides")
    asset = relationship("Asset", back_populates="metadata_overrides")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("user_id", "asset_id", name="uq_user_asset_override"),
        {"schema": "portfolio"}
    )
```

### Pydantic Schemas

**Input Schema** (for PATCH request):
```python
class AssetMetadataOverride(BaseModel):
    sector_override: Optional[str] = None
    industry_override: Optional[str] = None
    country_override: Optional[str] = None
```

**Response Schema** (for GET requests):
```python
class AssetWithOverrides(BaseModel):
    id: int
    symbol: str
    name: str
    asset_type: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    effective_sector: Optional[str] = None
    effective_industry: Optional[str] = None
    effective_country: Optional[str] = None
    # ... other asset fields
```

## Usage Examples

### Example 1: Setting Overrides for an ETF

```bash
# Get asset details
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/assets/123

# Response shows Yahoo Finance has no metadata
{
  "id": 123,
  "symbol": "ARKK",
  "sector": null,
  "industry": null,
  "country": null
}

# Set user-specific overrides
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sector_override": "Technology",
    "industry_override": "Software",
    "country_override": "US"
  }' \
  http://localhost:8000/assets/123/metadata-overrides

# Response confirms overrides
{
  "id": 1,
  "user_id": 5,
  "asset_id": 123,
  "sector_override": "Technology",
  "industry_override": "Software",
  "country_override": "US"
}
```

### Example 2: Viewing Effective Metadata

```bash
# Get held assets (includes effective metadata)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/assets/held/all?portfolio_id=1

# Response shows effective values
[
  {
    "id": 123,
    "symbol": "ARKK",
    "sector": null,
    "industry": null,
    "country": null,
    "effective_sector": "Technology",
    "effective_industry": "Software",
    "effective_country": "US"
  }
]
```

### Example 3: Distribution with Overrides

```bash
# Get sector distribution (automatically uses effective_sector)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/assets/distribution/sectors?portfolio_id=1

# Response includes assets with overrides
{
  "Technology": 45000.50,
  "Healthcare": 30000.00
}
# ARKK (with override) is included in Technology sector
```

### Example 4: Attempting Invalid Override

```bash
# Try to override existing Yahoo Finance data
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sector_override": "Technology"
  }' \
  http://localhost:8000/assets/456/metadata-overrides

# Error response (asset 456 already has sector from Yahoo Finance)
{
  "detail": "Cannot override 'sector': Yahoo Finance already provides data (Healthcare)"
}
```

### Example 5: Different Users, Different Overrides

```bash
# User 1 sets their preferences
curl -X PATCH \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sector_override": "Technology"}' \
  http://localhost:8000/assets/123/metadata-overrides

# User 2 sets different preferences for the same asset
curl -X PATCH \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sector_override": "Financials"}' \
  http://localhost:8000/assets/123/metadata-overrides

# User 1's distribution shows Technology
curl -H "Authorization: Bearer $USER1_TOKEN" \
  http://localhost:8000/assets/distribution/sectors?portfolio_id=1
# {"Technology": 10000.00}

# User 2's distribution shows Financials
curl -H "Authorization: Bearer $USER2_TOKEN" \
  http://localhost:8000/assets/distribution/sectors?portfolio_id=2
# {"Financials": 10000.00}
```

## Migration

The database migration creates the new table:

```bash
# Apply migration (Docker)
docker compose exec api alembic upgrade head

# Apply migration (local development)
alembic upgrade head
```

Migration file: `20251103_1400-add_asset_metadata_overrides.py`

## Testing

### Unit Tests

Test CRUD functions:
```python
def test_set_asset_metadata_overrides_success():
    # Asset has no Yahoo Finance data
    # User sets overrides
    # Assert override record created

def test_set_asset_metadata_overrides_blocked():
    # Asset has Yahoo Finance data for sector
    # User tries to override sector
    # Assert HTTPException raised

def test_get_effective_asset_metadata():
    # Asset has sector from Yahoo Finance
    # User has overridden industry (which was NULL)
    # Assert effective_sector = Yahoo Finance
    # Assert effective_industry = user override
```

### Integration Tests

Test API endpoints:
```python
def test_patch_metadata_overrides_endpoint():
    # POST request with valid overrides
    # Assert 200 response
    # Assert database record created

def test_get_held_assets_with_overrides():
    # User has overrides for asset 123
    # GET /assets/held/all
    # Assert effective_* fields populated

def test_distribution_includes_overrides():
    # User has sector override for ETF
    # GET /assets/distribution/sectors
    # Assert ETF value included in override sector
```

## Best Practices

### For Users

1. **Only override when necessary**: Let Yahoo Finance data take precedence
2. **Use consistent classifications**: Choose sector/industry names consistently
3. **Update overrides**: If Yahoo Finance later provides data, your override becomes inactive
4. **Check distributions**: Verify your classifications appear in charts correctly

### For Developers

1. **Always pass user_id**: All effective metadata functions require user context
2. **Use effective_* fields**: In distributions and insights, use `effective_sector` not `sector`
3. **Validate early**: Check Yahoo Finance data before attempting override
4. **Test user isolation**: Ensure users don't see each other's overrides

## Security Considerations

### Authorization

- **User isolation**: Users can only set their own overrides
- **Asset ownership**: Users can set overrides for any asset (even if not held)
  - This allows setting overrides before buying an asset
- **Read access**: Users only see their own effective metadata

### Data Integrity

- **Foreign key constraints**: Deleting user/asset removes overrides
- **Unique constraint**: One override record per (user, asset)
- **Validation**: Cannot override existing Yahoo Finance data
- **Type safety**: Pydantic schemas validate input

## Performance Considerations

### Database Queries

- **Indexes**: user_id and asset_id are indexed
- **Join optimization**: Use LEFT JOIN to fetch overrides with assets
- **Batch queries**: Fetch all overrides for a portfolio in one query

Example optimized query:
```python
# Good: Single query with join
assets_with_overrides = (
    db.query(Asset, AssetMetadataOverride)
    .outerjoin(
        AssetMetadataOverride,
        and_(
            AssetMetadataOverride.asset_id == Asset.id,
            AssetMetadataOverride.user_id == current_user.id
        )
    )
    .all()
)

# Bad: N+1 queries
assets = db.query(Asset).all()
for asset in assets:
    override = get_user_asset_override(db, current_user.id, asset.id)  # N queries!
```

### Caching

Currently, no caching is implemented for overrides. Possible optimizations:

- **In-memory cache**: Cache user overrides for active portfolio (5-minute TTL)
- **Request-level cache**: Fetch all user overrides once per request
- **Invalidation**: Clear cache on PATCH to metadata-overrides endpoint

## Future Enhancements

Possible improvements:

1. **Bulk override management**: Set overrides for multiple assets at once
2. **Override suggestions**: Suggest classifications based on asset name/description
3. **Import/export**: Export user overrides, import to another account
4. **Override history**: Track changes to overrides over time
5. **Admin validation**: Flag suspicious overrides for review
6. **Preset classifications**: Predefined sector/industry lists to choose from

## Troubleshooting

### "Cannot override 'sector': Yahoo Finance already provides data"

**Cause**: The asset already has sector data from Yahoo Finance.

**Solution**: Overrides are fallback-only. You cannot override existing Yahoo Finance data. This is by design to maintain data integrity.

### Overrides not appearing in distribution charts

**Possible causes**:
1. Asset not held in the portfolio
2. Transactions for the asset have sold all shares
3. Override set for wrong asset_id

**Debug steps**:
```bash
# Check if asset is held
GET /assets/held/all?portfolio_id=1

# Check effective metadata
# Look for effective_sector, effective_industry, effective_country fields

# Check override record
GET /assets/123  # Check if your override is returned
```

### Different users seeing different distributions

**This is expected behavior!** Overrides are user-specific.

Each user sees their own classifications in distributions and insights. This allows users to have personalized views of their portfolios.

## Related Documentation

- [Data Models](data-models.md) - Database schema details
- [Asset Management](../user-guide/assets.md) - User guide for assets
- [Portfolio Insights](../user-guide/insights.md) - How insights use overrides
- [API Endpoints](../api/endpoints.md) - Full API reference

## Summary

Asset Metadata Overrides provide a powerful, user-specific system for classifying assets when Yahoo Finance lacks data:

✅ **User-specific**: Each user has their own classification preferences  
✅ **Fallback-only**: Cannot override existing Yahoo Finance data  
✅ **Automatic integration**: Works seamlessly with distributions and insights  
✅ **Flexible**: Set any combination of sector, industry, country  
✅ **Validated**: Comprehensive validation prevents invalid overrides  

This feature ensures complete portfolio analytics even for assets with limited metadata from data providers.

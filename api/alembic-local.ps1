# Alembic Helper Script for Local Development
# Sets environment variables to connect to localhost database

# Set database connection to localhost (for dev environment)
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_DB="portfolium"
$env:POSTGRES_USER="portfolium"
$env:POSTGRES_PASSWORD="portfolium"
$env:POSTGRES_PORT="5432"

# Run alembic command
$alembicPath = "C:\Users\itsmi\Documents\Dev\JS\Portfolium\.venv\Scripts\alembic.exe"

Write-Host "Database: postgresql://portfolium:***@localhost:5432/portfolium" -ForegroundColor Green
Write-Host "Running: alembic $args" -ForegroundColor Cyan
Write-Host ""

& $alembicPath $args

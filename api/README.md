# Portfolium API

Backend API for Portfolium investment tracking application.

## Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -e .
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Run API locally
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

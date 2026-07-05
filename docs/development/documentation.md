# Documentation Workflow

Portfolium documentation is built with MkDocs Material and served by the web image at `/docs`.

## Local Development

Install documentation and API dependencies in a virtual environment:

```bash
pip install -r docs/requirements.txt -e ./api
```

Serve the documentation locally:

```bash
mkdocs serve
```

The default MkDocs server runs at `http://localhost:8000`. If the API already uses that port, choose another one:

```bash
mkdocs serve --dev-addr=127.0.0.1:8001
```

## Build and Validate

Run the full docs quality gate:

```bash
make docs-check
```

This command:

1. exports the FastAPI OpenAPI schema to `docs/api/openapi.json`;
2. checks for placeholder markers in Markdown files;
3. verifies that every Markdown page is tracked by `docs/audit.yml`;
4. runs `mkdocs build --strict`.

## Project Structure

```text
docs/
├── index.md
├── getting-started/
├── user-guide/
├── widgets/
├── detailed-metrics/
├── api/
├── technical/
├── development/
├── admin/
├── stylesheets/
└── javascripts/
```

The site navigation is configured in `mkdocs.yml`. Add new pages to the navigation unless they are intentionally private source fragments.

## Writing Guidelines

- Document the user workflow first, then implementation details.
- Keep API schemas generated from FastAPI instead of duplicating every field manually.
- Link to source files only when it helps maintainers find the implementation.
- Add operational notes for environment variables, background jobs, cache behavior, and failure modes.
- Include tests or docs checks in the same pull request when behavior changes.

## Docker Integration

`web/Dockerfile` installs `docs/requirements.txt`, builds MkDocs, and copies the generated site into the web image. The production nginx container serves it under `/docs`.

# Portfolium Documentation

This directory contains the source files for Portfolium's documentation, built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

## Local Development

### Prerequisites

Install MkDocs and dependencies:

```bash
pip install mkdocs mkdocs-material pymdown-extensions
```

### Serve Locally

From the project root, run:

```bash
mkdocs serve
```

This will start a development server at `http://localhost:8000` (MkDocs default port).

For integration with the Vite dev server at `http://localhost:5173/docs`, run:

```bash
mkdocs serve --dev-addr=127.0.0.1:8001
```

Then access the docs through the main app at `http://localhost:5173/docs`.

### Build Documentation

To build the static documentation site:

```bash
mkdocs build
```

The built site will be output to the `site/` directory.

## Project Structure

```
docs/
├── index.md                    # Homepage
├── getting-started/
│   ├── installation.md
│   ├── quick-start.md
│   └── configuration.md
├── user-guide/
│   ├── portfolios.md
│   ├── transactions.md
│   ├── assets.md
│   ├── insights.md
│   ├── notifications.md
│   └── settings.md
├── api/
│   ├── overview.md
│   ├── authentication.md
│   └── endpoints.md
├── development/
│   ├── architecture.md
│   ├── contributing.md
│   └── testing.md
├── deployment/
│   ├── docker.md
│   └── environment.md
└── stylesheets/
    └── extra.css               # Custom pink theme
```

## Configuration

The documentation is configured via `mkdocs.yml` in the project root.

### Theme

We use the Material theme with a custom pink color scheme:

- **Primary color**: Pink (#ec4899)
- **Accent color**: Pink
- **Light/Dark mode**: Auto-switching based on user preference

### Custom Styling

Additional styling is in `docs/stylesheets/extra.css`, including:

- Pink gradient headers
- Custom code block styling
- Enhanced link hover effects
- Pink-themed admonitions

## Writing Documentation

### Markdown Extensions

The documentation supports:

- **Code highlighting** with syntax highlighting
- **Admonitions** for tips, warnings, etc.
- **Tabs** for multi-language examples
- **Tables** for structured data
- **Emojis** :rocket:

### Example: Admonitions

```markdown
!!! tip "Pro Tip"
    This is a helpful tip!

!!! warning "Important"
    Pay attention to this warning!

!!! danger "Critical"
    This is critical information!
```

### Example: Code Blocks

```markdown
\```python
def hello_world():
    print("Hello, Portfolium!")
\```
```

### Example: Tabs

```markdown
=== "Python"
    \```python
    import requests
    \```

=== "JavaScript"
    \```javascript
    const response = await fetch();
    \```
```

## Deployment

### Production Build

In production, the documentation is:

1. Built as part of the web Docker image
2. Copied to `/usr/share/nginx/html/docs`
3. Served by nginx at `/docs`

The production build is automatically handled by the `web/Dockerfile`:

```dockerfile
FROM python:3.11-alpine AS docs
RUN pip install mkdocs mkdocs-material pymdown-extensions
COPY ../mkdocs.yml /docs/
COPY ../docs /docs/docs
RUN mkdocs build
```

### Accessing in Production

After building and running the Docker containers:

```
http://localhost:5173/docs
```

Or in production:

```
https://your-domain.com/docs
```

## Contributing

When adding new documentation:

1. Create/update markdown files in the appropriate directory
2. Update the navigation in `mkdocs.yml` if adding new pages
3. Test locally with `mkdocs serve`
4. Ensure all links work correctly
5. Follow the existing style and structure

## Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [Markdown Guide](https://www.markdownguide.org/)

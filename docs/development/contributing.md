# 🤝 Contributing to Portfolium

Thank you for your interest in contributing!  
Portfolium is an open-source, self-hosted portfolio tracker, contributions from the community help it improve and grow.  
Whether you're fixing bugs, improving docs, or adding new features, every PR is appreciated ❤️

---

## 📌 Ways to Contribute

| Type | Examples |
|---|---|
| 🐛 Bug fixes | Crashes, incorrect API responses, UI layout issues |
| ✨ Features | New analytics tools, integrations, UX improvements |
| 📚 Documentation | Tutorials, examples, clarifications, screenshots |
| 🧪 Testing | Backend API tests, frontend unit tests |
| 🧹 Refactors | Better structure, performance, code cleanup |

If you don’t know where to start:  
👉 https://github.com/ArthurMTX/Portfolium/issues

---

## 🧑‍💻 Development Setup

### Clone & run dev environment

```bash
git clone https://github.com/ArthurMTX/Portfolium.git
cd Portfolium
cp .env.example .env

docker compose -f docker-compose.dev.yml up -d --build
```

Access:

| Service | URL |
|---|---|
| Frontend (HMR) | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |
| Task Monitor (Flower) | http://localhost:5555 |

---

## 🔀 Branching & Pull Requests

### Branch naming

| Purpose | Pattern |
|---|---|
| Features | feat/feature-name |
| Bug fix | fix/issue-description |
| Docs | docs/update-topic |
| Refactor | refactor/module-name |

### PR guidelines

Before submitting:

- Keep changes focused & atomic
- Add screenshots for UI changes
- Link issues using `Fixes #ID`
- Write meaningful commit messages

Examples:

```
feat(chart): new sector allocation view
fix(api): incorrect daily P&L rounding
docs(install): expand docker quickstart
```

---

## 🧪 Testing

Backend:

```bash
docker compose exec api pytest -v
```

Frontend:

```bash
cd web
npm run test
```

---

## 🧠 Coding Style

| Layer | Rules |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Pydantic format with black/ruff |
| Frontend | TypeScript only, React + shadcn/ui, components reusable & accessible |

---

## 🗣 Communication

For large features, please open an issue or discussion first:

- New API or architecture change
- New data providers or integrations
- Major UI redesign or refactor

---

## 🌸 Thank You

Every contribution helps Portfolium bloom.  
We’re happy you’re here 💜

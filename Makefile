.PHONY: up down logs restart test clean dev dev-backend dev-up dev-down dev-logs dev-restart dev-restart-build dev-up-build build-prod

build-prod:
	docker build -t arthurmtx/portfolium-db:latest ./db && docker build -t arthurmtx/portfolium-api:latest -f ./api/Dockerfile . && docker build -t arthurmtx/portfolium-web:latest -f ./web/Dockerfile . 

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	docker compose restart

test:
	docker compose exec api pytest tests/ -v

clean:
	docker compose down -v
	rm -rf api/__pycache__ web/node_modules web/dist

# Hybrid development: backend in Docker, frontend local
dev-backend:
	docker compose -f docker-compose.dev.yml up -d api db redis celery-worker celery-beat flower

dev:
	@echo "Starting backend services in Docker..."
	docker compose -f docker-compose.dev.yml up -d api db redis celery-worker celery-beat flower
	@echo "Backend ready! Now run 'cd web && npm run dev' to start frontend locally"

dev-up-build:
	docker compose -f ./docker-compose.dev.yml up -d --build

dev-up:
	docker compose -f ./docker-compose.dev.yml up -d

dev-down:
	docker compose -f ./docker-compose.dev.yml down

dev-logs:
	docker compose -f ./docker-compose.dev.yml logs -f --tail=100

dev-restart: dev-down dev-up dev-logs

dev-restart-build: dev-down dev-up-build dev-logs


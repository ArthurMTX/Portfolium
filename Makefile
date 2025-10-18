.PHONY: up down logs restart seed test clean

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	docker compose restart

seed:
	docker compose exec db psql -U portfolium -d portfolium -f /docker-entrypoint-initdb.d/02_seed.sql

test:
	docker compose exec api pytest tests/ -v

clean:
	docker compose down -v
	rm -rf api/__pycache__ web/node_modules web/dist

.PHONY: up down logs restart test clean

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

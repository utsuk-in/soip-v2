.PHONY: db db-setup db-shell install install-frontend migrate migration seed scrape backend frontend dev clean build up down

ifneq (,$(wildcard .env))
    include .env
    export $(shell sed 's/=.*//' .env)
endif

# ── Docker ──

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

# ── Database (Docker Postgres with pgvector) ──

db: up
	@echo "Postgres running in Docker"

db-setup:
	@echo "Setting up database (via init.sql on container startup)..."
	docker-compose exec postgres pg_isready -U postgres

db-shell:
	docker-compose exec postgres psql -U soip_admin -d soip_db

db-sync-render:
	@echo "Syncing database from source to Docker container..."
	pg_dump $$RENDER_DATABASE_URL | docker-compose exec -T postgres psql -U soip_admin -d soip_db

# ── Backend ──

install: up
	docker-compose exec backend pip install -r requirements.txt

migrate: up
	docker-compose exec backend alembic upgrade head

migration: up
	docker-compose exec backend alembic revision --autogenerate -m "$(msg)"

seed: up
	docker-compose exec backend python -m app.services.scraper --seed-only

seed-universities: up
	docker cp backend/scripts/seed_universities.py soip-backend:/app/seed_universities.py
	docker-compose exec backend python seed_universities.py

scrape: up
	docker-compose exec backend python -m app.services.scraper

embed: up
	docker-compose exec backend python -m app.scripts.embed_pending

backend: up
	@echo "Backend running on http://localhost:8000"
	docker-compose logs -f backend

# ── Frontend ──

install-frontend: up
	docker-compose exec frontend bun install

frontend: up
	@echo "Frontend running on http://localhost:3000"
	docker-compose logs -f frontend

# ── Convenience ──

dev: up
	@echo "Services running:"
	@echo "  Backend:   http://localhost:8000"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Database:  localhost:5433 (or $$POSTGRES_PORT)"
	@echo ""
	@echo "Common commands:"
	@echo "  make migrate   # run migrations"
	@echo "  make seed      # load sources"
	@echo "  make db-shell  # connect to database"

clean:
	docker-compose down -v
	docker system prune -f

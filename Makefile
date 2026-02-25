.PHONY: db db-setup db-shell install install-frontend migrate migration seed scrape backend frontend dev clean

# ── Database (local Postgres with pgvector) ──

db:
	brew services start postgresql@17 2>/dev/null || pg_ctl -D $(shell brew --prefix)/var/postgresql@17 start
	@echo "Postgres running"

db-setup:
	@echo "Creating database and user..."
	-psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='soip_admin'" | grep -q 1 || \
		psql -U postgres -c "CREATE USER soip_admin WITH PASSWORD 'soip_secure_password';"
	-psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='soip_db'" | grep -q 1 || \
		psql -U postgres -c "CREATE DATABASE soip_db OWNER soip_admin;"
	psql -U soip_admin -d soip_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
	psql -U soip_admin -d soip_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
	psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE soip_db TO soip_admin;"
	@echo "Database ready: soip_db on localhost:5432"

db-shell:
	psql -U soip_admin -d soip_db

# ── Backend ──

install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

migrate:
	cd backend && . .venv/bin/activate && alembic upgrade head

migration:
	cd backend && . .venv/bin/activate && alembic revision --autogenerate -m "$(msg)"

seed:
	cd backend && . .venv/bin/activate && python -m app.services.scraper --seed-only

scrape:
	cd backend && . .venv/bin/activate && python -m app.services.scraper

embed:
	cd backend && . .venv/bin/activate && python -m app.scripts.embed_pending

validate:
	cd backend && . .venv/bin/activate && python -m app.scripts.validate_scrape CryptNit2

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8007

# ── Frontend ──

install-frontend:
	cd frontend && bun install

frontend:
	cd frontend && bun run dev

# ── Convenience ──

dev:
	@echo "Run these in separate terminals:"
	@echo "  make backend   # start FastAPI on :8000"
	@echo "  make frontend  # start React on :3000"
	@echo ""
	@echo "First-time setup:"
	@echo "  make db-setup  # create database + extensions"
	@echo "  make install   # Python venv + deps"
	@echo "  make migrate   # run migrations"
	@echo "  make seed      # load sources"

clean:
	cd backend && rm -rf .venv
	cd frontend && rm -rf node_modules

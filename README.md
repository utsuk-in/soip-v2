# SOIP — Student Opportunity Intelligence Platform

A RAG-powered platform that aggregates student opportunities (hackathons, internships, scholarships, fellowships, grants) from Indian sources, and surfaces them through a conversational AI interface with personalized relevance matching.

## Architecture

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL (pgvector)
- **Frontend:** React 19 + Bun + TailwindCSS
- **AI:** OpenAI GPT-4o-mini (extraction + chat) + text-embedding-3-small (embeddings)
- **Scraping:** Crawl4AI (JS rendering) + httpx (static HTML)
- **Search:** Hybrid retrieval — pgvector similarity + PostgreSQL full-text search + metadata filtering + Reciprocal Rank Fusion

## Prerequisites

- **Python 3.12+**
- **Bun** — `curl -fsSL https://bun.sh/install | bash`
- **PostgreSQL 17** with **pgvector** extension
- **OpenAI API key**

### Installing PostgreSQL + pgvector (macOS)

```bash
brew install postgresql@17
brew install pgvector

# Start Postgres
brew services start postgresql@17

# Verify it's running
psql -U postgres -c "SELECT version();"
```

## Setup

```bash
# 1. Create your .env
cp .env.example .env
# Edit .env → add your OPENAI_API_KEY

# 2. Create the database, user, and extensions
make db-setup

# 3. Install backend dependencies
make install

# 4. Run database migrations
make migrate

# 5. Seed opportunity sources 
make seed

# 6. Scrape / crawl sources (scrape only those that are marked Enabled True in the sources table will be executed)
make scrape

# 6. Generate vector embeddings
make embed

# . Install frontend dependencies
make install-frontend
```

## Running

Open **two terminals**:

```bash
# Terminal 1 — Backend API
make backend

# Terminal 2 — Frontend
make frontend
```

- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Frontend: http://localhost:3000

## Useful Commands

```bash
make db-setup        # Create database, user, pgvector extension
make db-shell        # Open psql shell
make install         # Create venv + install Python deps
make install-frontend  # Install frontend deps (bun install)
make backend         # Start FastAPI dev server
make frontend        # Start React dev server
make migrate         # Run Alembic migrations
make migration msg="description"  # Generate new migration
make seed            # Seed 15 opportunity sources
make scrape          # Run the full scraping pipeline
make embed           # Generate embeddings (run after make scrape for RAG + recommendations)
make validate        # Validate scrape: counts by source, optional title via app.scripts.validate_scrape <title>
make clean           # Remove venv + node_modules
```

### After scraping: embeddings and personalized recommendations

1. **Generate embeddings** (required for chat RAG and personalized recommendations):
   ```bash
   make embed
   ```
   This embeds all content chunks and opportunities that don’t yet have vectors.

2. **Test personalized opportunities**:
   - Start the app: `make backend` (and optionally `make frontend`).
   - **Register** (e.g. via UI or `POST /api/auth/register`) and **log in** (`POST /api/auth/login`) to get a JWT.
   - **Set your profile** so recommendations can match you:  
     `PUT /api/users/profile` with a body like:
     ```json
     {
       "first_name": "Your Name",
       "degree_type": "undergraduate",
       "skills": ["Python", "ML"],
       "interests": ["hackathons", "AI"],
       "aspirations": ["internship", "fellowship"]
     }
     ```
   - Call **personalized recommendations**:  
     `GET /api/opportunities/recommended?limit=10` with header  
     `Authorization: Bearer <your_jwt_token>`.
   - In the frontend, use the dashboard or “Recommended” section while logged in.

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | — | Create account |
| `/api/auth/login` | POST | — | Get JWT token |
| `/api/auth/me` | GET | JWT | Current user |
| `/api/users/profile` | GET/PUT | JWT | Profile CRUD |
| `/api/users/universities` | GET | — | List universities |
| `/api/opportunities` | GET | — | Browse with filters |
| `/api/opportunities/recommended` | GET | JWT | Personalized top-N |
| `/api/opportunities/{id}` | GET | — | Detail view |
| `/api/chat` | POST | JWT | Send message (RAG) |
| `/api/chat/sessions` | GET | JWT | List chat sessions |
| `/api/chat/sessions/{id}` | GET | JWT | Session history |
| `/api/alerts` | GET | JWT | User alerts |
| `/api/alerts/{id}/read` | PUT | JWT | Mark alert read |

## Project Structure

```
soip-v2/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── config.py          # Settings from environment
│   │   ├── database.py        # SQLAlchemy engine + sessions
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routers/           # API route handlers
│   │   ├── services/          # Business logic
│   │   │   ├── scraper/       # Crawl4AI + extraction pipeline
│   │   │   ├── embedder.py    # OpenAI embedding service
│   │   │   ├── retriever.py   # Hybrid search + RRF fusion
│   │   │   ├── relevance.py   # Profile-aware re-ranking
│   │   │   ├── chat.py        # RAG orchestration
│   │   │   ├── auth.py        # JWT + password hashing
│   │   │   ├── alerts.py      # Alert generation
│   │   │   └── scheduler.py   # APScheduler jobs
│   │   └── utils/
│   ├── alembic/               # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             # LoginPage, DashboardPage, BrowsePage, ChatPage, etc.
│   │   ├── components/        # Layout, OpportunityCard, ChatBubble, FilterSidebar
│   │   └── lib/               # API client, auth context
│   └── package.json
├── init.sql                   # DB bootstrap reference (user, db, extensions)
├── Makefile                   # All dev commands
└── .env.example
```

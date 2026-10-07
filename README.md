# Expense Tracker AI

An enterprise-ready, AI-powered daily expense tracker mobile application featuring auto-tracking of transactions from SMS alerts and payment notifications (GPay, PhonePe, Paytm, and banking apps).

---

## High-Standard Architecture & Directory Structure

```
├── .dockerignore                 # Root docker ignore rules
├── .gitignore                    # Monorepo git ignore rules
├── docker-compose.yml            # Multi-container orchestration (FastAPI + PostgreSQL)
├── README.md                     # Project documentation
│
├── backend/                      # Production Python FastAPI backend
│   ├── .dockerignore             # Backend-specific docker ignore
│   ├── .env.example              # Environment variables template for deployment
│   ├── alembic.ini               # Database migrations configuration
│   ├── Dockerfile                # Production-hardened container specification with healthcheck
│   ├── pytest.ini                # Pytest configuration with pythonpath and filter rules
│   ├── requirements.txt          # Python runtime dependencies
│   ├── app/                      # Application core package
│   │   ├── __init__.py
│   │   ├── config.py             # Environment settings & production secret validation
│   │   ├── main.py               # FastAPI entrypoint, middleware, routers, /health check
│   │   ├── db/                   # Database session, seed, and Alembic migrations
│   │   ├── models/               # SQLAlchemy ORM models (AES-256 encrypted fields)
│   │   ├── routers/              # Modular API endpoints (Auth, Transactions, AI, etc.)
│   │   ├── schemas/              # Pydantic v2 validation models
│   │   └── services/             # Core business logic (AI Gemini, Auth, Document, Crypto)
│   ├── media/receipts/           # Uploaded user receipts (.gitkeep tracked)
│   └── tests/                    # Pytest unit and integration test suite
│
└── frontend/                     # React Native (Expo & NativeWind) mobile application
    ├── .env.example              # Frontend environment template (API URL)
    ├── .gitignore                # Frontend git ignore rules
    ├── app.json                  # Expo application configuration
    ├── App.tsx                   # Mobile root component & navigation container
    ├── package.json              # NPM dependencies & run scripts
    ├── tsconfig.json             # TypeScript compiler configuration
    └── src/                      # Source directory
        ├── components/           # Reusable UI design system & components
        │   └── common/           # Common components (StatCard, LoadingSpinner, EmptyState)
        ├── constants/            # Design tokens, colors, API endpoints, storage keys
        ├── hooks/                # Custom React hooks (useDebounce, etc.)
        ├── navigation/           # React Navigation stack & bottom tab navigators
        ├── screens/              # Core mobile screens (Dashboard, Scan, Transactions, etc.)
        ├── services/             # Network layer & Axios API client with token refresh
        ├── store/                # Zustand state stores & hardware-backed SecureStore
        ├── types/                # Central TypeScript types & data models
        └── utils/                # Formatting helpers (Currency, Date, Error parser)
```

---

## Production Deployment Guide

### 1. Backend Service (Docker & Cloud Platforms)
1. Copy the environment configuration:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Set your production secrets in `.env`:
   - `ENVIRONMENT=production`
   - `SECRET_KEY`: Random 32+ character string
   - `REFRESH_SECRET_KEY`: Random 32+ character string
   - `ENCRYPTION_KEY`: 32-byte Fernet base64 key
   - `DATABASE_URL`: PostgreSQL connection string with asyncpg driver
   - `GEMINI_API_KEY`: Google Gemini API key

3. Start services with Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
4. Verify the container health check probe:
   ```bash
   curl http://localhost:8000/health
   ```

### 2. Frontend Mobile App
1. Configure frontend environment:
   ```bash
   cp frontend/.env.example frontend/.env
   # Update EXPO_PUBLIC_API_URL to your deployed backend URL: https://api.yourdomain.com/api
   ```
2. Install dependencies & typecheck:
   ```bash
   cd frontend
   npm install
   npx tsc --noEmit
   ```
3. Run or build:
   ```bash
   npm run android   # Local Android run
   npm run web       # Web test run
   ```

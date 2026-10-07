# Expense Tracker AI - Backend API Service

This is the production-ready REST API service powering **Expense Tracker AI**, built using Python FastAPI, PostgreSQL (SQLAlchemy), and Google Gemini 2.0 Flash.

## Core Stack
- **Framework**: FastAPI (asyncpg)
- **Database**: PostgreSQL (SQLAlchemy + Alembic)
- **AI Integration**: Google Gemini 2.0 Flash (structured output APIs)
- **Security**: JWT Access/Refresh tokens, bcrypt hashing, column-level AES-256 (Fernet) encryption

---

## Getting Started

### Local Setup
1. **Create virtual environment & Install dependencies**:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/expense_tracker
   SECRET_KEY=generate-a-secure-random-key-here
   REFRESH_SECRET_KEY=generate-another-secure-random-key-here
   ENCRYPTION_KEY=y1B9N8Wq6M4w8E-XjA4Vn5K6jV4W4l7R4x1D8f9V2s0=
   GEMINI_API_KEY=your-gemini-2.0-flash-api-key
   ```

3. **Database migrations**:
   ```bash
   alembic upgrade head
   ```

4. **Seed database with test data**:
   ```bash
   python -m app.db.seed
   ```

5. **Start server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   API Docs will be available at `http://localhost:8000/docs`.

### Docker Setup
To spin up both the FastAPI backend and PostgreSQL database:
```bash
docker-compose up --build
```

---

## Security Details
To protect user privacy, bank accounts, balances, and transaction reference numbers are encrypted at the column level.
- Symmetrical key-derivation is done from `ENCRYPTION_KEY` using SHA256.
- Database entries for `accounts.name`, `accounts.balance` and `transactions.ref_number` are stored in encrypted string formats but decrypted transparently on retrieval.

---

## Testing
Run unit tests within the virtual environment:
```bash
pytest
```

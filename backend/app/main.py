from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select

from app.db.session import engine, async_session
from app.models.models import Base, Category

# Import routers
from app.routers import (
    auth,
    users,
    accounts,
    categories,
    transactions,
    budgets,
    savings_goals,
    subscriptions,
    notifications,
    reports,
    analytics,
    admin,
    ai,
    media
)

# Initialize slowapi Rate Limiter
limiter = Limiter(key_func=get_remote_address)

SYSTEM_CATEGORIES = [
    {"name": "Food", "icon": "food-fork-spoon", "color": "#EF4444", "type": "Expense"},
    {"name": "Grocery", "icon": "cart", "color": "#F59E0B", "type": "Expense"},
    {"name": "Shopping", "icon": "shopping", "color": "#EC4899", "type": "Expense"},
    {"name": "Bills", "icon": "file-document", "color": "#3B82F6", "type": "Expense"},
    {"name": "Fuel", "icon": "gas-station", "color": "#10B981", "type": "Expense"},
    {"name": "Travel", "icon": "bus", "color": "#8B5CF6", "type": "Expense"},
    {"name": "Medical", "icon": "medical-bag", "color": "#EF4444", "type": "Expense"},
    {"name": "Entertainment", "icon": "gamepad-variant", "color": "#EC4899", "type": "Expense"},
    {"name": "Salary", "icon": "cash-multiple", "color": "#10B981", "type": "Income"},
    {"name": "Investment", "icon": "trending-up", "color": "#3B82F6", "type": "Income"},
    {"name": "Rent", "icon": "home-variant", "color": "#6B7280", "type": "Expense"},
    {"name": "EMI", "icon": "credit-card", "color": "#EF4444", "type": "Expense"},
    {"name": "Others", "icon": "dots-horizontal", "color": "#9CA3AF", "type": "Expense"}
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database schema successfully verified/initialized.")

        # Seed system categories if not present
        async with async_session() as session:
            q = select(Category).where(Category.user_id == None).limit(1)
            result = await session.execute(q)
            if not result.scalar_one_or_none():
                for cat in SYSTEM_CATEGORIES:
                    session.add(Category(
                        name=cat["name"],
                        icon=cat["icon"],
                        color=cat["color"],
                        type=cat["type"],
                        is_custom=False
                    ))
                await session.commit()
                print("Default system categories initialized.")
    except Exception as e:
        print(f"Warning during database initialization: {e}")
    yield
    await engine.dispose()

app = FastAPI(
    title="Expense Tracker AI Backend",
    description="Enterprise-grade production REST APIs powering Expense Tracker AI.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Connect rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware Configurations
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8081", # Default React Native dev server
    "*" # Allowed for easy API connectivity in different mobile environments
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(savings_goals.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(media.router, prefix="/api")

@app.get("/health")
async def health_check():
    """
    Unthrottled health check probe for load balancers, container orchestrators, and monitoring.
    """
    return {
        "status": "healthy",
        "service": "Expense Tracker AI APIs",
        "api_version": "1.0.0"
    }

@app.get("/")
async def root(request: Request):
    """
    Root status check.
    """
    return {
        "status": "healthy",
        "service": "Expense Tracker AI APIs",
        "api_version": "1.0.0",
        "documentation": "/docs"
    }

# General error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log internal server exception details
    print(f"Unhandled Exception at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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

app = FastAPI(
    title="Expense Tracker AI Backend",
    description="Enterprise-grade production REST APIs powering Expense Tracker AI.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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

import pytest
from datetime import timedelta
from app.services.auth_service import auth_service

def test_password_hashing():
    password = "MySecurePassword123!"
    hashed = auth_service.get_password_hash(password)
    
    assert hashed != password
    assert len(hashed) > 0
    assert auth_service.verify_password(password, hashed) is True
    assert auth_service.verify_password("wrong_password", hashed) is False

def test_access_token_lifecycle():
    data = {"sub": "12345678-1234-5678-1234-567812345678", "role": "admin"}
    token = auth_service.create_access_token(data)
    
    assert isinstance(token, str)
    assert len(token) > 0
    
    decoded = auth_service.decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == data["sub"]
    assert decoded["role"] == "admin"
    assert decoded["type"] == "access"

def test_refresh_token_lifecycle():
    data = {"sub": "87654321-4321-8765-4321-876543210987"}
    token = auth_service.create_refresh_token(data, expires_delta=timedelta(days=1))
    
    assert isinstance(token, str)
    assert len(token) > 0
    
    decoded = auth_service.decode_refresh_token(token)
    assert decoded is not None
    assert decoded["sub"] == data["sub"]
    assert decoded["type"] == "refresh"

def test_invalid_token_decoding():
    assert auth_service.decode_access_token("invalid_token_string") is None
    assert auth_service.decode_refresh_token("invalid_token_string") is None
